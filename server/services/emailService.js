const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host: host,
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: false,
      auth: { user, pass }
    });
  } else {
    // Generate Ethereal test account if no SMTP credentials provided
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('Nodemailer initialized with Ethereal test account:', testAccount.user);
    } catch (e) {
      console.warn('Could not initialize Ethereal test account. OTP will be logged directly to console.');
      transporter = null;
    }
  }

  return transporter;
};

const sendOtpEmail = async (toEmail, otpCode) => {
  console.log(`\n========================================`);
  console.log(`[NOTICIA 2FA SECURITY] OTP Code for ${toEmail}: >>> ${otpCode} <<<`);
  console.log(`========================================\n`);

  try {
    const mailer = await getTransporter();
    if (mailer) {
      const info = await mailer.sendMail({
        from: '"Noticia SIEM Security" <security@noticia.local>',
        to: toEmail,
        subject: `Noticia SIEM - Your Two-Factor Verification Code: ${otpCode}`,
        text: `Your Noticia verification code is: ${otpCode}. It expires in 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px; border: 1px solid #1e293b; border-radius: 8px; background: #0f172a; color: #f8fafc;">
            <h2 style="color: #38bdf8; margin-top: 0;">Noticia SIEM Security</h2>
            <p>Your one-time two-factor authentication pass-code is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #22c55e; margin: 20px 0; padding: 12px; background: #1e293b; text-align: center; border-radius: 6px;">
              ${otpCode}
            </div>
            <p style="color: #94a3b8; font-size: 13px;">This code will expire in 10 minutes. If you did not attempt to sign in to Noticia, please contact your SOC administrator immediately.</p>
          </div>
        `
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[Nodemailer] OTP Preview URL: ${previewUrl}`);
      }
      return { sent: true, previewUrl };
    }
  } catch (error) {
    console.warn('Failed to send email via transporter:', error.message);
  }

  return { sent: true, loggedToConsole: true };
};

module.exports = {
  sendOtpEmail
};
