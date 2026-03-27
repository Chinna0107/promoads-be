const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

router.get('/visitor-count', async (req, res) => {
  try {
    const result = await sql`
      INSERT INTO visitor_count (id, count) 
      VALUES (1, 1) 
      ON CONFLICT (id) 
      DO UPDATE SET count = visitor_count.count + 1 
      RETURNING count
    `;
    res.json({ count: result[0].count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const existing = await sql`SELECT email FROM quotations WHERE email = ${email} LIMIT 1`;
    const isExistingUser = existing.length > 0;

    await sql`DELETE FROM otps WHERE email = ${email}`;
    await sql`INSERT INTO otps (email, otp) VALUES (${email}, ${otp})`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Verification - CODEATHON 2K26',
      text: `Your OTP is: ${otp}`
    });

    res.json({ message: 'OTP sent successfully', isExistingUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const individual = await sql`SELECT email FROM individual_registrations WHERE email = ${email} LIMIT 1`;
    const quotation = await sql`SELECT email FROM quotations WHERE email = ${email} LIMIT 1`;

    if (individual.length === 0 && quotation.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await sql`DELETE FROM otps WHERE email = ${email}`;
    await sql`INSERT INTO otps (email, otp) VALUES (${email}, ${otp})`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset OTP',
      text: `Your password reset OTP is: ${otp}`
    }).catch(err => console.error('Email send error:', err));

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    if (!email || !otp || !newPassword || typeof email !== 'string' || typeof otp !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ message: 'Email, OTP, and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    
    const otpResult = await sql`SELECT * FROM otps WHERE email = ${email} AND otp = ${otp}`;
    
    if (otpResult.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    
    const individual = await sql`SELECT email FROM individual_registrations WHERE email = ${email}`;
    const quotation = await sql`SELECT email FROM quotations WHERE email = ${email}`;

    if (individual.length === 0 && quotation.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (individual.length > 0) {
      await sql`UPDATE individual_registrations SET password = ${hashedPassword} WHERE email = ${email}`;
    }
    if (quotation.length > 0) {
      await sql`UPDATE quotations SET password = ${hashedPassword} WHERE email = ${email}`;
    }
    
    await sql`DELETE FROM otps WHERE email = ${email}`;
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp || typeof email !== 'string' || typeof otp !== 'string') {
      return res.status(400).json({ error: 'Valid email and OTP are required' });
    }
    const result = await sql`SELECT * FROM otps WHERE email = ${email} AND otp = ${otp}`;
    
    if (result.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

router.post('/register-quotation', async (req, res) => {
  try {
    const { name, email, mobile, address, eventName, eventDate, eventTime, priceRange, description, password, isExistingUser } = req.body;

    if (!name || !email || !mobile || !address || !eventName || !eventDate || !eventTime || !priceRange) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    let hashedPassword;

    if (isExistingUser) {
      const existing = await sql`SELECT password FROM quotations WHERE email = ${email} LIMIT 1`;
      if (existing.length === 0) return res.status(404).json({ error: 'Existing user not found' });
      hashedPassword = existing[0].password;
    } else {
      if (!password) return res.status(400).json({ error: 'Password is required' });
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const result = await sql`
      INSERT INTO quotations (name, email, mobile, address, event_name, event_date, event_time, price_range, description, password)
      VALUES (${name}, ${email}, ${mobile}, ${address}, ${eventName}, ${eventDate}, ${eventTime}, ${priceRange}, ${description || null}, ${hashedPassword})
      RETURNING id, name, email, event_name
    `;

    await sql`DELETE FROM otps WHERE email = ${email}`;

    res.json({ message: 'Quotation submitted successfully', quotation: result[0] });
  } catch (error) {
    console.error('Quotation registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, rollNo, mobile, year, branch, email, college, password, eventId, eventName, transactionId, screenshotUrl, isExistingUser, paymentMethod, coordinator } = req.body;

    if (!name || !email || !mobile || !year || !branch || !college || !eventId || !eventName) {
      return res.status(400).json({ error: 'All required fields must be filled' });
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    let hashedPassword = null;
    
    if (!isExistingUser && password) {
      hashedPassword = await bcrypt.hash(password, 10);
    } else if (isExistingUser) {
      const existingUser = await sql`
        SELECT password FROM individual_registrations WHERE email = ${email} LIMIT 1
      `;
      if (existingUser.length > 0) {
        hashedPassword = existingUser[0].password;
      }
    }

    const registration = await sql`
      INSERT INTO individual_registrations (event_id, event_name, name, email, mobile, roll_no, year, branch, college, password, transaction_id, screenshot_url, payment_status, payment_method, coordinator)
      VALUES (${eventId}, ${eventName}, ${name}, ${email}, ${mobile}, ${rollNo}, ${year}, ${branch}, ${college}, ${hashedPassword}, ${transactionId}, ${screenshotUrl}, 'completed', ${paymentMethod || 'upi'}, ${coordinator || null})
      RETURNING *
    `;

    const token = jwt.sign({ email, type: 'individual' }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });

    res.json({ message: 'Registration successful', token, registration: registration[0] });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { emailOrMobile, password } = req.body;

  if (!emailOrMobile || !password || typeof emailOrMobile !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Valid email/mobile and password are required.' });
  }

  try {
    // Check quotations table first
    const quotation = await sql`
      SELECT *, 'quotation' as type FROM quotations
      WHERE email = ${emailOrMobile}
      LIMIT 1
    `;

    if (quotation.length > 0) {
      const user = quotation[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: 'Incorrect password.' });

      const isAdmin = user.is_admin || false;

      const token = jwt.sign(
        { id: user.id, email: user.email, type: 'quotation', is_admin: isAdmin },
        process.env.JWT_SECRET || 'secret123',
        { expiresIn: '1h' }
      );

      return res.json({
        message: 'Login successful',
        token,
        is_admin: isAdmin,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          address: user.address,
          eventName: user.event_name,
          eventDate: user.event_date,
          eventTime: user.event_time,
          priceRange: user.price_range,
        },
      });
    }

    const individual = await sql`
      SELECT *, 'individual' as type FROM individual_registrations 
      WHERE email = ${emailOrMobile} OR mobile = ${emailOrMobile}
      LIMIT 1
    `;

    const user = individual[0] || null;
    if (!user) return res.status(401).json({ error: 'User not found.' });

    if (!user.password) return res.status(401).json({ error: 'User password not set. Please reset password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password.' });

    const isAdmin = user.is_admin || false;

    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: isAdmin, type: 'individual' },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        rollNo: user.roll_no,
        year: user.year,
        branch: user.branch,
        college: user.college
      },
      is_admin: isAdmin
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const { email, type } = req.user;
    if (!email || !type) return res.status(401).json({ error: 'Invalid token' });

    if (type === 'quotation') {
      const profile = await sql`SELECT * FROM quotations WHERE email = ${email} LIMIT 1`;
      if (profile.length === 0) return res.status(404).json({ error: 'Profile not found' });
      const u = profile[0];
      return res.json({ id: u.id, name: u.name, email: u.email, address: u.address, eventName: u.event_name, eventDate: u.event_date, eventTime: u.event_time, priceRange: u.price_range });
    }

    const profile = await sql`SELECT * FROM individual_registrations WHERE email = ${email} LIMIT 1`;
    if (profile.length === 0) return res.status(404).json({ error: 'Profile not found' });
    const u = profile[0];
    res.json({ id: u.id, name: u.name, email: u.email, mobile: u.mobile, rollNo: u.roll_no, year: u.year, branch: u.branch, college: u.college, eventName: u.event_name });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.get('/quotation', verifyToken, async (req, res) => {
  try {
    const { email } = req.user;
    const result = await sql`SELECT * FROM quotations WHERE email = ${email} ORDER BY created_at DESC`;
    if (result.length === 0) return res.status(404).json({ error: 'No quotation found' });
    res.json(result.map(q => ({
      id: q.id,
      name: q.name,
      email: q.email,
      mobile: q.mobile,
      address: q.address,
      eventName: q.event_name,
      eventDate: q.event_date,
      eventTime: q.event_time,
      priceRange: q.price_range,
      description: q.description,
      createdAt: q.created_at,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/registered-events', verifyToken, async (req, res) => {
  try {
    const { email } = req.user;
    const registrations = await sql`
      SELECT DISTINCT event_name, event_id FROM individual_registrations WHERE email = ${email}
    `;
    const events = registrations.map(r => ({ id: r.event_id, name: r.event_name, icon: '🎯', color: '#667eea' }));
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
