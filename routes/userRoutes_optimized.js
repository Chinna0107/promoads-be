const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { verifyToken } = require('../middleware/auth');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Middleware: Set cache headers
const setCacheHeaders = (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.set('Content-Encoding', 'gzip');
  next();
};

// Helper: Format user response (minimal payload)
const formatUserResponse = (user, type) => ({
  id: user.id,
  name: type === 'individual' ? user.name : user.leader_name,
  email: type === 'individual' ? user.email : user.leader_email,
  mobile: type === 'individual' ? user.mobile : user.leader_mobile
});

// Helper: Format registration response (minimal payload)
const formatRegistrationResponse = (registration) => ({
  id: registration.id,
  eventName: registration.event_name,
  status: 'completed'
});

router.get('/visitor-count', setCacheHeaders, async (req, res) => {
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
    
    // Optimized: Single query with LIMIT
    const [existingIndividual, existingTeam] = await Promise.all([
      sql`SELECT 1 FROM individual_registrations WHERE email = ${email} LIMIT 1`,
      sql`SELECT 1 FROM team_registrations WHERE leader_email = ${email} LIMIT 1`
    ]);
    
    const isExistingUser = existingIndividual.length > 0 || existingTeam.length > 0;
    
    await sql`DELETE FROM otps WHERE email = ${email}`;
    await sql`INSERT INTO otps (email, otp) VALUES (${email}, ${otp})`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Verification - CODEATHON 2K26',
      text: `Your OTP is: ${otp}`
    });

    res.json({ isExistingUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await sql`SELECT 1 FROM otps WHERE email = ${email} AND otp = ${otp}`;
    
    if (result.length === 0) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, rollNo, mobile, year, branch, email, college, password, eventId, eventName, transactionId, screenshotUrl, isExistingUser, paymentMethod, coordinator, paid } = req.body;

    if (!eventId || !eventName) {
      return res.status(400).json({ error: 'Event ID and Event Name required' });
    }

    let hashedPassword = null;
    if (!isExistingUser && password) {
      hashedPassword = await bcrypt.hash(password, 10);
    } else if (isExistingUser) {
      const existing = await sql`SELECT password FROM individual_registrations WHERE email = ${email} LIMIT 1`;
      hashedPassword = existing[0]?.password;
    }

    // Optimized: Only insert required fields
    const registration = await sql`
      INSERT INTO individual_registrations (event_id, event_name, name, email, mobile, roll_no, year, branch, college, password, transaction_id, screenshot_url, payment_status, payment_method, coordinator, paid)
      VALUES (${eventId}, ${eventName}, ${name}, ${email}, ${mobile}, ${rollNo}, ${year}, ${branch}, ${college}, ${hashedPassword}, ${transactionId}, ${screenshotUrl}, 'completed', ${paymentMethod || 'upi'}, ${coordinator || null}, ${paid || true})
      RETURNING id, event_name
    `;

    const token = jwt.sign({ email, type: 'individual' }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });

    res.json({ token, registration: formatRegistrationResponse(registration[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/register-team', async (req, res) => {
  try {
    const { teamName, teamLeader, members, eventId, eventName, transactionId, screenshotUrl, isExistingUser, paymentMethod, coordinator, paid } = req.body;
    
    const totalMembers = (members?.length || 0) + 1;
    const amount = totalMembers * 50;

    let hashedPassword = null;
    if (!isExistingUser && teamLeader.password) {
      hashedPassword = await bcrypt.hash(teamLeader.password, 10);
    } else if (isExistingUser) {
      const [existing] = await Promise.all([
        sql`SELECT leader_password FROM team_registrations WHERE leader_email = ${teamLeader.email} LIMIT 1`,
        sql`SELECT password FROM individual_registrations WHERE email = ${teamLeader.email} LIMIT 1`
      ]);
      hashedPassword = existing[0]?.leader_password || existing[1]?.password;
    }

    // Optimized: Only insert required fields
    const registration = await sql`
      INSERT INTO team_registrations (
        event_id, event_name, team_name,
        leader_name, leader_email, leader_mobile, leader_roll_no, leader_year, leader_branch, leader_college, leader_password,
        member2_name, member2_email, member2_mobile, member2_roll_no, member2_year, member2_branch, member2_college,
        member3_name, member3_email, member3_mobile, member3_roll_no, member3_year, member3_branch, member3_college,
        member4_name, member4_email, member4_mobile, member4_roll_no, member4_year, member4_branch, member4_college,
        transaction_id, screenshot_url, amount, payment_status, payment_method, coordinator, paid
      )
      VALUES (
        ${eventId}, ${eventName}, ${teamName},
        ${teamLeader.name}, ${teamLeader.email}, ${teamLeader.mobile}, ${teamLeader.rollNo}, ${teamLeader.year}, ${teamLeader.branch}, ${teamLeader.college}, ${hashedPassword},
        ${members[0]?.name || null}, ${members[0]?.email || null}, ${members[0]?.mobile || null}, ${members[0]?.rollNo || null}, ${members[0]?.year || null}, ${members[0]?.branch || null}, ${members[0]?.college || null},
        ${members[1]?.name || null}, ${members[1]?.email || null}, ${members[1]?.mobile || null}, ${members[1]?.rollNo || null}, ${members[1]?.year || null}, ${members[1]?.branch || null}, ${members[1]?.college || null},
        ${members[2]?.name || null}, ${members[2]?.email || null}, ${members[2]?.mobile || null}, ${members[2]?.rollNo || null}, ${members[2]?.year || null}, ${members[2]?.branch || null}, ${members[2]?.college || null},
        ${transactionId}, ${screenshotUrl}, ${amount}, 'completed', ${paymentMethod || 'upi'}, ${coordinator || null}, ${paid || true}
      )
      RETURNING id, event_name
    `;

    const token = jwt.sign({ email: teamLeader.email, type: 'team' }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });

    res.json({ token, registration: formatRegistrationResponse(registration[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', setCacheHeaders, async (req, res) => {
  const { emailOrMobile, password } = req.body;

  if (!emailOrMobile || !password) {
    return res.status(400).json({ error: 'Email/Mobile and password required' });
  }

  try {
    // Optimized: SELECT only required fields
    const [individual, team] = await Promise.all([
      sql`SELECT id, password, paid, email, mobile, name, roll_no, year, branch, college FROM individual_registrations WHERE email = ${emailOrMobile} OR mobile = ${emailOrMobile} LIMIT 1`,
      sql`SELECT id, leader_password, paid, leader_email, leader_mobile, leader_name, leader_roll_no, leader_year, leader_branch, leader_college FROM team_registrations WHERE leader_email = ${emailOrMobile} OR leader_mobile = ${emailOrMobile} LIMIT 1`
    ]);

    const user = individual[0] || team[0];
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const userPassword = individual[0] ? user.password : user.leader_password;
    const match = await bcrypt.compare(password, userPassword);

    if (!match) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    if (!user.paid) {
      return res.status(403).json({ error: 'Payment not verified' });
    }

    const type = individual[0] ? 'individual' : 'team';
    const token = jwt.sign({ id: user.id, email: individual[0] ? user.email : user.leader_email, type }, process.env.JWT_SECRET || 'secret123', { expiresIn: '1h' });

    res.json({
      token,
      user: formatUserResponse(user, type)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/profile', verifyToken, setCacheHeaders, async (req, res) => {
  try {
    const { email, type } = req.user;
    
    // Optimized: SELECT only required fields
    const query = type === 'individual' 
      ? sql`SELECT id, name, email, mobile, roll_no, year, branch, college, event_name FROM individual_registrations WHERE email = ${email} LIMIT 1`
      : sql`SELECT id, leader_name as name, leader_email as email, leader_mobile as mobile, leader_roll_no as roll_no, leader_year as year, leader_branch as branch, leader_college as college, event_name FROM team_registrations WHERE leader_email = ${email} LIMIT 1`;
    
    const profile = await query;
    if (profile.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const user = profile[0];
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      rollNo: user.roll_no,
      year: user.year,
      branch: user.branch,
      college: user.college,
      eventName: user.event_name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optimized: Pagination with cursor
router.get('/registered-events', verifyToken, setCacheHeaders, async (req, res) => {
  try {
    const { email, type } = req.user;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const cursor = req.query.cursor || '';
    
    // Optimized: SELECT only required fields
    const query = type === 'individual'
      ? sql`SELECT DISTINCT event_name, event_id FROM individual_registrations WHERE email = ${email} ORDER BY event_id LIMIT ${limit + 1}`
      : sql`SELECT DISTINCT event_name, event_id FROM team_registrations WHERE leader_email = ${email} ORDER BY event_id LIMIT ${limit + 1}`;
    
    const registrations = await query;
    const hasMore = registrations.length > limit;
    const events = registrations.slice(0, limit).map(r => ({
      id: r.event_id,
      name: r.event_name
    }));

    res.json({
      events,
      hasMore,
      nextCursor: hasMore ? events[events.length - 1].id : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/payment-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { paymentStatus } = req.body;
    const isPaid = paymentStatus === 'paid';

    await Promise.all([
      sql`UPDATE individual_registrations SET paid = ${isPaid} WHERE id = ${userId}`,
      sql`UPDATE team_registrations SET paid = ${isPaid} WHERE id = ${userId}`
    ]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
