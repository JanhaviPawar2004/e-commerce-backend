const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const otpGenerator = require('otp-generator');

// 1. Send OTP to email
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  pool.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'DB Error' });
    if (results.length === 0) return res.status(404).json({ message: 'Email not registered' });

    const user = results[0];

    const otp = otpGenerator.generate(6, {
      digits: true,
      upperCaseAlphabets: false,
      specialChars: false,
      alphabets: false,
    });

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    console.log("Generated OTP:", otp);  // 👈 Add this
    // Optional: hash OTP before storing
    // const hashedOtp = bcrypt.hashSync(otp, 10);

    pool.query(
      'INSERT INTO password_resets (user_id, otp, expires_at) VALUES (?, ?, ?)',
      [user.user_id, otp, expiresAt],
      async (err2) => {
        console.error("Insert OTP error:", err2); // 👈 Add this
        if (err2) return res.status(500).json({ message: 'Error saving OTP' });

        // Send OTP via email
        const transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
            user: 'dukaanifyofficialemail@gmail.com',
            pass: 'spti qbaf aqee oldh'
          }
        });

        await transporter.sendMail({
          from: 'Dukaanify Support <yourgmail@gmail.com>',
          to: email,
          subject: 'Your Dukaanify OTP Code',
          text: `Hi, your OTP is ${otp}. It expires in 10 minutes.`
        });

        res.json({ message: 'OTP sent successfully' });
      }
    );
  });
});

router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
  
    pool.query(
      'SELECT u.user_id , pr.otp, pr.expires_at FROM users u JOIN password_resets pr ON u.user_id = pr.user_id WHERE u.email = ? ORDER BY pr.expires_at DESC LIMIT 1',
      [email],
      (err, results) => {
        if (err) return res.status(500).json({ message: 'DB error' });
        if (results.length === 0) return res.status(404).json({ message: 'No OTP found' });
  
        const record = results[0];
        const isExpired = new Date() > new Date(record.expires_at);
  
        if (isExpired) return res.status(400).json({ message: 'OTP expired' });
        console.log("Entered OTP:", otp);
        console.log("Stored OTP:", record.otp);
        
        // const match = bcrypt.compareSync(otp, record.otp);
        const match = otp === record.otp;

        console.log("Do they match?", match);
        if (!match) return res.status(400).json({ message: 'Invalid OTP' });
        
        pool.query('DELETE FROM password_resets WHERE user_id = ?', [record.user_id]);
        res.json({ message: 'OTP verified successfully', user_id: record.user_id });
      }
    );
  });

  router.post('/reset-password', (req, res) => {
    const { user_id, newPassword } = req.body;
  
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
  
    pool.query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, user_id], (err) => {
      if (err) return res.status(500).json({ message: 'Failed to reset password' });
  
      // Clean up the OTPs
      pool.query('DELETE FROM password_resets WHERE user_id = ?', [user_id]);
  
      res.json({ message: 'Password reset successful' });
    });
  });

  module.exports = router;

  