const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { authenticateAdmin } = require('./adminAuth');
const nodemailer = require('nodemailer');
const multer = require('multer');

// TRI-COD 2K26 Admin Routes - Updated
const storage = multer.memoryStorage();
const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

router.get('/events', authenticateAdmin, async (req, res) => {
  try {
    const events = await sql`SELECT DISTINCT event_id, event_name FROM individual_registrations
                              UNION
                              SELECT DISTINCT event_id, event_name FROM team_registrations`;
    res.json(events.map(e => ({ id: e.event_id, eventId: e.event_id, name: e.event_name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/registrations', authenticateAdmin, async (req, res) => {
  try {
    const individual = await sql`SELECT *, 'individual' as type FROM individual_registrations`;
    const team = await sql`SELECT *, 'team' as type FROM team_registrations`;
    const registrations = [...individual, ...team].sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at));
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/registrations/event/:eventId', authenticateAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    const individual = await sql`SELECT * FROM individual_registrations WHERE event_id = ${eventId}`;
    const team = await sql`SELECT * FROM team_registrations WHERE event_id = ${eventId}`;
    const registrations = [...individual, ...team];
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/all', authenticateAdmin, async (req, res) => {
  try {
    const individual = await sql`SELECT id, name, email FROM individual_registrations`;
    const team = await sql`SELECT id, leader_name as name, leader_email as email FROM team_registrations`;
    const users = [...individual, ...team];
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const individual = await sql`SELECT id, name, email FROM individual_registrations`;
    const team = await sql`SELECT id, leader_name as name, leader_email as email FROM team_registrations`;
    const users = [...individual, ...team];
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/send-notification', authenticateAdmin, upload.single('attachment'), async (req, res) => {
  try {
    const { title, message, sendToAll, userIds } = req.body;
    
    let recipients = [];
    if (sendToAll === 'true' || sendToAll === true) {
      const individual = await sql`SELECT email FROM individual_registrations`;
      const team = await sql`SELECT leader_email as email FROM team_registrations`;
      recipients = [...individual, ...team].map(u => u.email);
    } else {
      const parsedIds = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;
      const individual = await sql`SELECT email FROM individual_registrations WHERE id IN ${sql(parsedIds)}`;
      const team = await sql`SELECT leader_email as email FROM team_registrations WHERE id IN ${sql(parsedIds)}`;
      recipients = [...individual, ...team].map(u => u.email);
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found' });
    }

    for (const email of recipients) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: title,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      };

      if (req.file) {
        mailOptions.attachments = [{
          filename: req.file.originalname,
          content: req.file.buffer
        }];
      }

      await transporter.sendMail(mailOptions);
    }

    res.json({ message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/notifications/send', authenticateAdmin, upload.single('attachment'), async (req, res) => {
  try {
    const { title, message, sendToAll, userIds } = req.body;
    
    let recipients = [];
    if (sendToAll === 'true' || sendToAll === true) {
      const individual = await sql`SELECT email FROM individual_registrations`;
      const team = await sql`SELECT leader_email as email FROM team_registrations`;
      recipients = [...individual, ...team].map(u => u.email);
    } else {
      const parsedIds = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;
      const individual = await sql`SELECT email FROM individual_registrations WHERE id IN ${sql(parsedIds)}`;
      const team = await sql`SELECT leader_email as email FROM team_registrations WHERE id IN ${sql(parsedIds)}`;
      recipients = [...individual, ...team].map(u => u.email);
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found' });
    }

    for (const email of recipients) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: title,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      };

      if (req.file) {
        mailOptions.attachments = [{
          filename: req.file.originalname,
          content: req.file.buffer
        }];
      }

      await transporter.sendMail(mailOptions);
    }

    res.json({ message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
