const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

// === EMAIL TRANSPORTER ===
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'dukaanifyofficialemail@gmail.com',
    pass: 'spti qbaf aqee oldh'
  },
});

// === CRON JOB TO DELETE EXPIRED OTPS ===
cron.schedule('*/5 * * * *', () => {
  pool.query(
    'DELETE FROM signup_otps WHERE created_at < (NOW() - INTERVAL 3 MINUTE)',
    (err, result) => {
      if (err) {
        console.error('Error deleting expired OTPs:', err);
      } else {
        console.log(`Expired OTPs deleted: ${result.affectedRows}`);
      }
    }
  );
});

// === STEP 1: REQUEST SIGNUP OTP ===
router.post('/request-otp', (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email is required' });

  // Check if email already exists in users
  pool.query('SELECT * FROM users WHERE email = ?', [email], (checkErr, userResults) => {
    if (checkErr) return res.status(500).json({ message: 'Database error' });
    if (userResults.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Check if OTP already sent within 3 minutes
    pool.query(
      'SELECT * FROM signup_otps WHERE email = ? AND created_at >= (NOW() - INTERVAL 3 MINUTE)',
      [email],
      (otpCheckErr, otpResults) => {
        if (otpCheckErr) return res.status(500).json({ message: 'Error checking OTP' });

        if (otpResults.length > 0) {
          return res.status(429).json({ message: 'OTP already sent. Try again in a few minutes.' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Clear old, unverified OTPs
        pool.query('DELETE FROM signup_otps WHERE email = ? AND is_verified = FALSE', [email], () => {
          pool.query('INSERT INTO signup_otps (email, otp) VALUES (?, ?)', [email, otp], (err) => {
            if (err) return res.status(500).json({ message: 'Database error inserting OTP' });

            const mailOptions = {
              from: 'Dukaanify Support <dukaanifyofficialemail@gmail.com>',
              to: email,
              subject: 'Your Signup OTP',
              // text: `Your OTP for signup is: ${otp}. It expires in 3 minutes.`,
              html: `
    <div style="display: inline-block;">
      <h2 style="color: #007BFF;">Your One-Time Password (OTP)</h2>
      <p>Hello,</p>
      <p>Your OTP for signup is: 
        <span style="font-size: 16px; color: red;">${otp}</span>
      </p>
      <p>This OTP is valid for only <strong>3 minutes</strong>. Do not share it with anyone.</p>
      <hr style="margin-top: 20px; margin-bottom: 10px;" />
      <p style="font-size: 12px; color: #666;">This is an automated email, please do not reply.</p>
    </div>
  `
            };

            transporter.sendMail(mailOptions, (emailErr) => {
              if (emailErr) return res.status(500).json({ message: 'Failed to send OTP' });

              res.status(200).json({ message: 'OTP sent successfully' });
            });
          });
        });
      }
    );
  });
});

// === STEP 2: VERIFY OTP ===
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

  pool.query(
    'SELECT * FROM signup_otps WHERE email = ? AND otp = ? AND created_at >= (NOW() - INTERVAL 3 MINUTE)',
    [email, otp],
    (err, results) => {
      if (err) return res.status(500).json({ message: 'Database error verifying OTP' });

      if (results.length === 0) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      pool.query(
        'UPDATE signup_otps SET is_verified = TRUE WHERE email = ?',
        [email],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ message: 'Error updating OTP status' });

          res.status(200).json({ message: 'OTP verified successfully' });
        }
      );
    }
  );
});

// === STEP 3: FINAL SIGNUP AFTER OTP VERIFICATION ===
router.post('/create-account', async (req, res) => {
  const { storeName, email, password } = req.body;

  if (!storeName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Check if OTP is verified
  pool.query(
    'SELECT * FROM signup_otps WHERE email = ? AND is_verified = TRUE',
    [email],
    async (otpErr, otpResults) => {
      if (otpErr) return res.status(500).json({ message: 'Database error checking OTP status' });

      if (otpResults.length === 0) {
        return res.status(403).json({ message: 'OTP not verified' });
      }

      // Check if user already exists (extra safety)
      pool.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error checking users' });

        if (results.length > 0) {
          return res.status(409).json({ message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create store
        pool.query('INSERT INTO stores (store_name) VALUES (?)', [storeName], (storeErr, storeResult) => {
          if (storeErr) return res.status(500).json({ message: 'Error creating store' });

          const newStoreId = storeResult.insertId;

          // Create user
          pool.query(
            'INSERT INTO users (email, password, user_type, store_id) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, 'shop_owner', newStoreId],
            (userErr, userResult) => {
              if (userErr) return res.status(500).json({ message: 'Failed to create user' });

              // Cleanup OTPs
              pool.query('DELETE FROM signup_otps WHERE email = ?', [email]);

              const welcomeMailOptions = {
                from: 'Dukaanify Support <dukaanifyofficialemail@gmail.com>',
                to: email,
                subject: 'Welcome to Dukaanify!',
                html: `
                  <div style="font-family: Arial, sans-serif; padding: 10px;">
                    <div style="max-width: 650px; margin: auto; background-color: #ffffff; border-radius: 8px; padding: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.05);">
                      <h2 style="color: #007BFF; text-align: center;">Welcome to Dukaanify!</h2>
                      <p style="font-size: 16px;">Hi there,</p>
                      <p style="font-size: 16px;">
                        Thank you for signing up with <strong>Dukaanify</strong> — your one-stop solution for building and managing your online store.
                      </p>
                      <p style="font-size: 16px;">
                        We're thrilled to have you on board. You can now start adding products, customizing your shop, and reaching more customers!
                      </p>
                      <p style="font-size: 16px;">
                        Need help getting started? Our support team is just a message away.
                      </p>
                      <p style="margin-top: 30px; font-size: 16px;">Warm regards,</p>
                      <p style="font-size: 16px;"><strong>Team Daisy</strong><br /></p>
                      <hr style="margin-top: 30px; margin-bottom: 10px;" />
                      <p style="font-size: 12px; color: #999999; text-align: center;">
                        Dukaanify - All Rights Reserved.
                      </p>
                    </div>
                  </div>
                `
              };
              
              transporter.sendMail(welcomeMailOptions, (emailErr) => {
                if (emailErr) {
                  console.error('Failed to send welcome email:', emailErr);
                } else {
                  console.log('Welcome email sent:', info.response);
                  console.log('✅ Welcome email sent to:', email);

                }
              });

              const token = jwt.sign({ id: userResult.insertId, email }, 'my_secret_key', {
                expiresIn: '1h',
              });

              res.status(201).json({ token });
            }
          );
        });
      });
    }
  );
});

module.exports = router;
