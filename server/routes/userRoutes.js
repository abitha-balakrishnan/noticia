const express = require('express');
const router = express.Router();
const dbStore = require('../services/dbStore');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// GET /api/users - Admin only list of all users
router.get('/', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const users = await dbStore.users.find({});
    const safeUsers = users.map(u => ({
      _id: u._id,
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt
    }));
    return res.json({
      success: true,
      data: safeUsers
    });
  } catch (error) {
    console.error('Fetch users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve users'
    });
  }
});

// PATCH /api/users/:id/role - Admin only update role
router.patch('/:id/role', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'analyst', 'viewer'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, analyst, or viewer'
      });
    }

    const updated = await dbStore.users.findByIdAndUpdate(
      req.params.id,
      { $set: { role } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`[USER ROLE UPDATE] User ${updated.email} updated to role '${role}' by ${req.user.name}`);

    return res.json({
      success: true,
      message: `User role updated to ${role}`,
      data: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role
      }
    });
  } catch (error) {
    console.error('Update role error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
});

module.exports = router;
