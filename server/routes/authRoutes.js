const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const dbStore = require('../services/dbStore');
const { sendOtpEmail } = require('../services/emailService');
const authMiddleware = require('../middleware/authMiddleware');

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'analyst', 'viewer']).optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const verifyOtpSchema = z.object({
  tempToken: z.string().min(1, 'Temporary token is required'),
  otp: z.string().length(6, 'OTP must be a 6-digit code')
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors[0].message,
        errors: parseResult.error.errors
      });
    }

    const { name, email, password, role } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await dbStore.users.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    // Check total user count: first registered user can be admin, subsequent default to analyst
    const userCount = await dbStore.users.countDocuments({});
    let assignedRole = role || 'analyst';
    if (userCount === 0) {
      assignedRole = 'admin'; // First user is automatically bootstrap admin
    } else if (assignedRole === 'admin') {
      assignedRole = 'analyst'; // Non-first users cannot self-assign admin
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await dbStore.users.create({
      name,
      email: normalizedEmail,
      passwordHash,
      role: assignedRole,
      createdAt: new Date()
    });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register account'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors[0].message
      });
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await dbStore.users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate 6-digit OTP code (valid for 10 minutes)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await dbStore.users.findByIdAndUpdate(user._id, {
      $set: { otpCode, otpExpires }
    });

    // Send email / log to console
    const emailResult = await sendOtpEmail(user.email, otpCode);

    // Issue temporary token for OTP verification stage (valid for 15 minutes)
    const secret = process.env.JWT_SECRET || 'noticia_jwt_secret_key_2026_super_secure_key';
    const tempToken = jwt.sign(
      { id: user._id.toString(), type: '2fa_stage' },
      secret,
      { expiresIn: '15m' }
    );

    return res.json({
      success: true,
      message: 'Verification code sent to registered email',
      otpRequired: true,
      tempToken,
      previewOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined,
      previewUrl: emailResult.previewUrl
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process login request'
    });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const parseResult = verifyOtpSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        message: parseResult.error.errors[0].message
      });
    }

    const { tempToken, otp } = parseResult.data;
    const secret = process.env.JWT_SECRET || 'noticia_jwt_secret_key_2026_super_secure_key';

    let decoded;
    try {
      decoded = jwt.verify(tempToken, secret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Verification session has expired. Please log in again.'
      });
    }

    if (decoded.type !== '2fa_stage') {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    const user = await dbStore.users.findById(decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found'
      });
    }

    if (!user.otpCode || user.otpCode !== otp.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 6-digit verification code'
      });
    }

    if (!user.otpExpires || new Date() > new Date(user.otpExpires)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    // Clear OTP on successful verification
    await dbStore.users.findByIdAndUpdate(user._id, {
      $set: { otpCode: null, otpExpires: null }
    });

    // Issue permanent auth JWT (valid for 24h)
    const token = jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        email: user.email,
        name: user.name
      },
      secret,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      message: 'Authentication successful',
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify authentication code'
    });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
  return res.json({
    success: true,
    message: 'User logged out successfully'
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
