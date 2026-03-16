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
    
    // Check if email already exists in registrations
    const existingIndividual = await sql`
      SELECT email FROM individual_registrations WHERE email = ${email} LIMIT 1
    `;
    
    const existingTeam = await sql`
      SELECT leader_email FROM team_registrations WHERE leader_email = ${email} LIMIT 1
    `;
    
    const isExistingUser = existingIndividual.length > 0 || existingTeam.length > 0;
    
    await sql`DELETE FROM otps WHERE email = ${email}`;
    await sql`INSERT INTO otps (email, otp) VALUES (${email}, ${otp})`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Verification - CODEATHON 2K26',
      text: `Your OTP is: ${otp}`
    });

    res.json({ 
      message: 'OTP sent successfully',
      isExistingUser: isExistingUser
    });
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
    const team = await sql`SELECT leader_email FROM team_registrations WHERE leader_email = ${email} LIMIT 1`;
    
    if (individual.length === 0 && team.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    await sql`DELETE FROM otps WHERE email = ${email}`;
    await sql`INSERT INTO otps (email, otp) VALUES (${email}, ${otp})`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset OTP - Codeathon 2K26',
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
    const team = await sql`SELECT leader_email FROM team_registrations WHERE leader_email = ${email}`;
    
    if (individual.length === 0 && team.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    if (individual.length > 0) {
      await sql`UPDATE individual_registrations SET password = ${hashedPassword} WHERE email = ${email}`;
    }
    if (team.length > 0) {
      await sql`UPDATE team_registrations SET leader_password = ${hashedPassword} WHERE leader_email = ${email}`;
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

router.post('/register-team', async (req, res) => {
  try {
    const { teamName, teamLeader, members, eventId, eventName, transactionId, screenshotUrl, isExistingUser, paymentMethod, coordinator } = req.body;
    
    if (!teamName || !teamLeader || !eventId || !eventName) {
      return res.status(400).json({ error: 'Team name, leader info, event ID and name are required' });
    }
    if (!teamLeader.name || !teamLeader.email || !teamLeader.mobile) {
      return res.status(400).json({ error: 'Team leader details incomplete' });
    }
    
    const totalMembers = (members?.length || 0) + 1;
    const amount = totalMembers * 50;

    let hashedPassword = null;
    
    if (!isExistingUser && teamLeader.password) {
      hashedPassword = await bcrypt.hash(teamLeader.password, 10);
    } else if (isExistingUser) {
      const existingLeader = await sql`
        SELECT leader_password FROM team_registrations WHERE leader_email = ${teamLeader.email} LIMIT 1
      `;
      if (existingLeader.length > 0) {
        hashedPassword = existingLeader[0].leader_password;
      } else {
        const existingIndividual = await sql`
          SELECT password FROM individual_registrations WHERE email = ${teamLeader.email} LIMIT 1
        `;
        if (existingIndividual.length > 0) {
          hashedPassword = existingIndividual[0].password;
        }
      }
    }

    const registration = await sql`
      INSERT INTO team_registrations (
        event_id, event_name, team_name,
        leader_name, leader_email, leader_mobile, leader_roll_no, leader_year, leader_branch, leader_college, leader_password,
        member2_name, member2_email, member2_mobile, member2_roll_no, member2_year, member2_branch, member2_college,
        member3_name, member3_email, member3_mobile, member3_roll_no, member3_year, member3_branch, member3_college,
        member4_name, member4_email, member4_mobile, member4_roll_no, member4_year, member4_branch, member4_college,
        transaction_id, screenshot_url, amount, payment_status, payment_method, coordinator
      )
      VALUES (
        ${eventId}, ${eventName}, ${teamName},
        ${teamLeader.name}, ${teamLeader.email}, ${teamLeader.mobile}, ${teamLeader.rollNo}, ${teamLeader.year}, ${teamLeader.branch}, ${teamLeader.college}, ${hashedPassword},
        ${members[0]?.name || null}, ${members[0]?.email || null}, ${members[0]?.mobile || null}, ${members[0]?.rollNo || null}, ${members[0]?.year || null}, ${members[0]?.branch || null}, ${members[0]?.college || null},
        ${members[1]?.name || null}, ${members[1]?.email || null}, ${members[1]?.mobile || null}, ${members[1]?.rollNo || null}, ${members[1]?.year || null}, ${members[1]?.branch || null}, ${members[1]?.college || null},
        ${members[2]?.name || null}, ${members[2]?.email || null}, ${members[2]?.mobile || null}, ${members[2]?.rollNo || null}, ${members[2]?.year || null}, ${members[2]?.branch || null}, ${members[2]?.college || null},
        ${transactionId}, ${screenshotUrl}, ${amount}, 'completed', ${paymentMethod || 'upi'}, ${coordinator || null}
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

  if (!emailOrMobile || !password || typeof emailOrMobile !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Valid email/mobile and password are required.' });
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
    if (!userPassword) {
      return res.status(401).json({ error: 'User password not set. Please reset password.' });
    }
    const match = await bcrypt.compare(password, userPassword);

    if (!match) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    const isPaid = user.paid || false;
    if (!isPaid) {
      return res.status(403).json({ error: 'Payment not verified. Please contact admin.' });
    }

    const isAdmin = user.is_admin || false;
    const userEmail = user.type === 'individual' ? user.email : user.leader_email;
    console.log(`Login successful: ${userEmail}, is_admin: ${isAdmin}`);

    const token = jwt.sign(
      { id: user.id, email: userEmail, is_admin: isAdmin, type: user.type },
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
        mobile: user.type === 'individual' ? user.mobile : user.leader_mobile,
        rollNo: user.type === 'individual' ? user.roll_no : user.leader_roll_no,
        year: user.type === 'individual' ? user.year : user.leader_year,
        branch: user.type === 'individual' ? user.branch : user.leader_branch,
        college: user.type === 'individual' ? user.college : user.leader_college
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
    if (!email || !type) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (type === 'individual') {
      const profile = await sql`SELECT * FROM individual_registrations WHERE email = ${email} LIMIT 1`;
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
    } else if (type === 'team') {
      const profile = await sql`SELECT * FROM team_registrations WHERE leader_email = ${email} LIMIT 1`;
      if (profile.length === 0) {
        return res.status(404).json({ error: 'Profile not found' });
      }
      const user = profile[0];
      res.json({
        id: user.id,
        name: user.leader_name,
        email: user.leader_email,
        mobile: user.leader_mobile,
        rollNo: user.leader_roll_no,
        year: user.leader_year,
        branch: user.leader_branch,
        college: user.leader_college,
        eventName: user.event_name
      });
    } else {
      res.status(400).json({ error: 'Invalid user type' });
    }
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/payment-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { paymentStatus } = req.body;
    
    if (!userId || !paymentStatus || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Valid userId and paymentStatus are required' });
    }
    
    const isPaid = paymentStatus === 'paid';

    await sql`UPDATE individual_registrations SET paid = ${isPaid} WHERE id = ${userId}`;
    await sql`UPDATE team_registrations SET paid = ${isPaid} WHERE id = ${userId}`;

    res.json({ success: true, message: 'Payment status updated' });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

router.get('/participant', async (req, res) => {
  const { roll } = req.query;
  try {
    const individual = await sql`SELECT * FROM individual_registrations WHERE roll_no = ${roll} LIMIT 1`;
    const team = await sql`SELECT * FROM team_registrations WHERE leader_roll_no = ${roll} LIMIT 1`;
    const participant = individual[0] || team[0];
    if (participant) {
      res.json(participant);
    } else {
      res.status(404).json({ error: 'Participant not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/registered-events', verifyToken, async (req, res) => {
  try {
    const { email, type } = req.user;
    
    let events = [];
    
    if (type === 'individual') {
      const registrations = await sql`
        SELECT DISTINCT event_name, event_id FROM individual_registrations 
        WHERE email = ${email}
      `;
      events = registrations.map(r => ({
        id: r.event_id,
        name: r.event_name,
        icon: '🎯',
        color: '#667eea'
      }));
    } else if (type === 'team') {
      const registrations = await sql`
        SELECT DISTINCT event_name, event_id FROM team_registrations 
        WHERE leader_email = ${email}
      `;
      events = registrations.map(r => ({
        id: r.event_id,
        name: r.event_name,
        icon: '👥',
        color: '#764ba2'
      }));
    }
    
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
