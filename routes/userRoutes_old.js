const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ dest: 'uploads/' });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

let visitorCount = 0;

router.get('/visitor-count', (req, res) => {
  visitorCount++;
  res.json({ count: visitorCount });
});

router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await sql`DELETE FROM otps WHERE email = ${email}`;
    await sql`INSERT INTO otps (email, otp) VALUES (${email}, ${otp})`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Verification - Trishna 2K25',
      text: `Your OTP is: ${otp}`
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await sql`SELECT * FROM otps WHERE email = ${email} AND otp = ${otp}`;
    
    if (result.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    await sql`DELETE FROM otps WHERE email = ${email}`;
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, rollNo, mobile, year, branch, email, college, password, eventId, eventName, transactionId, screenshotUrl, paid } = req.body;

    if (!eventId || !eventName) {
      return res.status(400).json({ error: 'Event ID and Event Name are required' });
    }

    const registration = await sql`
      INSERT INTO individual_registrations (event_id, event_name, name, email, mobile, roll_no, year, branch, college, transaction_id, screenshot_url, payment_status, paid)
      VALUES (${eventId}, ${eventName}, ${name}, ${email}, ${mobile}, ${rollNo}, ${year}, ${branch}, ${college}, ${transactionId}, ${screenshotUrl}, 'completed', ${paid})
      RETURNING *
    `;

    let user = await sql`SELECT * FROM users WHERE email = ${email}`;
    
    if (user.length === 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = await sql`
        INSERT INTO users (name, roll_no, mobile, year, branch, email, college, password, email_verified)
        VALUES (${name}, ${rollNo}, ${mobile}, ${year}, ${branch}, ${email}, ${college}, ${hashedPassword}, true)
        RETURNING *
      `;
    }

    const token = jwt.sign({ userId: user[0].id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });

    res.json({ message: 'Registration successful', token, user: user[0], registration: registration[0] });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/register-team', async (req, res) => {
  try {
    const { teamName, teamLeader, members, eventId, eventName, transactionId, paid } = req.body;
    const totalMembers = members.length + 1;
    const amount = totalMembers * 100;

    const registration = await sql`
      INSERT INTO team_registrations (
        event_id, event_name, team_name,
        leader_name, leader_email, leader_mobile, leader_roll_no, leader_year, leader_branch, leader_college,
        member2_name, member2_email, member2_mobile, member2_roll_no, member2_year, member2_branch, member2_college,
        member3_name, member3_email, member3_mobile, member3_roll_no, member3_year, member3_branch, member3_college,
        member4_name, member4_email, member4_mobile, member4_roll_no, member4_year, member4_branch, member4_college,
        transaction_id, amount, payment_status, paid
      )
      VALUES (
        ${eventId}, ${eventName}, ${teamName},
        ${teamLeader.name}, ${teamLeader.email}, ${teamLeader.mobile}, ${teamLeader.rollNo}, ${teamLeader.year}, ${teamLeader.branch}, ${teamLeader.college},
        ${members[0]?.name || null}, ${members[0]?.email || null}, ${members[0]?.mobile || null}, ${members[0]?.rollNo || null}, ${members[0]?.year || null}, ${members[0]?.branch || null}, ${members[0]?.college || null},
        ${members[1]?.name || null}, ${members[1]?.email || null}, ${members[1]?.mobile || null}, ${members[1]?.rollNo || null}, ${members[1]?.year || null}, ${members[1]?.branch || null}, ${members[1]?.college || null},
        ${members[2]?.name || null}, ${members[2]?.email || null}, ${members[2]?.mobile || null}, ${members[2]?.rollNo || null}, ${members[2]?.year || null}, ${members[2]?.branch || null}, ${members[2]?.college || null},
        ${transactionId}, ${amount}, 'completed', ${paid}
      )
      RETURNING *
    `;

    res.json({ message: 'Team registration successful', registration: registration[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/registrations', async (req, res) => {
  try {
    const individual = await sql`SELECT *, 'individual' as type FROM individual_registrations`;
    const team = await sql`SELECT *, 'team' as type FROM team_registrations`;
    const registrations = [...individual, ...team].sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at));
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
