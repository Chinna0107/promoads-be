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
    const { name, rollNo, mobile, year, branch, email, college, password, eventId, eventName, transactionId, screenshotUrl } = req.body;

    if (!eventId || !eventName) {
      return res.status(400).json({ error: 'Event ID and Event Name are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const registration = await sql`
      INSERT INTO individual_registrations (event_id, event_name, name, email, mobile, roll_no, year, branch, college, password, transaction_id, screenshot_url, payment_status)
      VALUES (${eventId}, ${eventName}, ${name}, ${email}, ${mobile}, ${rollNo}, ${year}, ${branch}, ${college}, ${hashedPassword}, ${transactionId}, ${screenshotUrl}, 'completed')
      RETURNING *
    `;

    const token = jwt.sign({ email, type: 'individual' }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });

    res.json({ message: 'Registration successful', token, registration: registration[0] });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/register-team', async (req, res) => {
  try {
    const { teamName, teamLeader, members, eventId, eventName, transactionId, screenshotUrl } = req.body;
    
    console.log('Team registration request:', { teamName, memberCount: members?.length, eventId, eventName });
    console.log('Members:', JSON.stringify(members, null, 2));
    
    const totalMembers = (members?.length || 0) + 1;
    const amount = totalMembers * 100;

    const hashedPassword = await bcrypt.hash(teamLeader.password, 10);

    const registration = await sql`
      INSERT INTO team_registrations (
        event_id, event_name, team_name,
        leader_name, leader_email, leader_mobile, leader_roll_no, leader_year, leader_branch, leader_college, leader_password,
        member2_name, member2_email, member2_mobile, member2_roll_no, member2_year, member2_branch, member2_college,
        member3_name, member3_email, member3_mobile, member3_roll_no, member3_year, member3_branch, member3_college,
        member4_name, member4_email, member4_mobile, member4_roll_no, member4_year, member4_branch, member4_college,
        transaction_id, screenshot_url, amount, payment_status
      )
      VALUES (
        ${eventId}, ${eventName}, ${teamName},
        ${teamLeader.name}, ${teamLeader.email}, ${teamLeader.mobile}, ${teamLeader.rollNo}, ${teamLeader.year}, ${teamLeader.branch}, ${teamLeader.college}, ${hashedPassword},
        ${members[0]?.name || null}, ${members[0]?.email || null}, ${members[0]?.mobile || null}, ${members[0]?.rollNo || null}, ${members[0]?.year || null}, ${members[0]?.branch || null}, ${members[0]?.college || null},
        ${members[1]?.name || null}, ${members[1]?.email || null}, ${members[1]?.mobile || null}, ${members[1]?.rollNo || null}, ${members[1]?.year || null}, ${members[1]?.branch || null}, ${members[1]?.college || null},
        ${members[2]?.name || null}, ${members[2]?.email || null}, ${members[2]?.mobile || null}, ${members[2]?.rollNo || null}, ${members[2]?.year || null}, ${members[2]?.branch || null}, ${members[2]?.college || null},
        ${transactionId}, ${screenshotUrl}, ${amount}, 'completed'
      )
      RETURNING *
    `;

    console.log('Registration successful:', registration[0].id);
    res.json({ message: 'Team registration successful', registration: registration[0] });
  } catch (error) {
    console.error('Team registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  const { emailOrMobile, password } = req.body;

  if (!emailOrMobile || !password) {
    return res.status(400).json({ error: 'Email/Mobile and password are required.' });
  }

  try {
    const individual = await sql`
      SELECT *, 'individual' as type FROM individual_registrations 
      WHERE email = ${emailOrMobile} OR mobile = ${emailOrMobile}
    `;

    const team = await sql`
      SELECT *, 'team' as type FROM team_registrations 
      WHERE leader_email = ${emailOrMobile} OR leader_mobile = ${emailOrMobile}
    `;

    let user = null;

    if (individual.length > 0) {
      user = individual[0];
    } else if (team.length > 0) {
      user = team[0];
    }

    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const userPassword = user.type === 'individual' ? user.password : user.leader_password;
    const match = await bcrypt.compare(password, userPassword);

    if (!match) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    const isAdmin = user.is_admin || false;
    const userEmail = user.type === 'individual' ? user.email : user.leader_email;
    console.log(`Login successful: ${userEmail}, is_admin: ${isAdmin}`);

    const token = jwt.sign(
      { id: user.id, email: userEmail, is_admin: isAdmin },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.type === 'individual' ? user.name : user.leader_name,
        email: userEmail,
        mobile: user.type === 'individual' ? user.mobile : user.leader_mobile
      },
      is_admin: isAdmin
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
