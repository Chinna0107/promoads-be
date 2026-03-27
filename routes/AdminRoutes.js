const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { authenticateAdmin } = require('./adminAuth');
const nodemailer = require('nodemailer');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// All quotations
router.get('/quotations', authenticateAdmin, async (req, res) => {
  try {
    const result = await sql`SELECT * FROM quotations ORDER BY created_at DESC`;
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
      status: q.status || 'pending',
      createdAt: q.created_at,
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update quotation status
router.put('/quotations/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await sql`UPDATE quotations SET status = ${status} WHERE id = ${id}`;
    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// All unique customers from quotations
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const result = await sql`
      SELECT DISTINCT ON (email)
        id, name, email, mobile, address, created_at,
        (SELECT COUNT(*) FROM quotations q2 WHERE q2.email = quotations.email) as quotation_count
      FROM quotations
      ORDER BY email, created_at DESC
    `;
    res.json(result.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      mobile: u.mobile,
      address: u.address,
      createdAt: u.created_at,
      quotationCount: parseInt(u.quotation_count),
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/all', authenticateAdmin, async (req, res) => {
  try {
    const result = await sql`SELECT DISTINCT ON (email) id, name, email FROM quotations ORDER BY email, created_at DESC`;
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard stats
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const total = await sql`SELECT COUNT(*) as count FROM quotations`;
    const pending = await sql`SELECT COUNT(*) as count FROM quotations WHERE status = 'pending' OR status IS NULL`;
    const confirmed = await sql`SELECT COUNT(*) as count FROM quotations WHERE status = 'confirmed'`;
    const rejected = await sql`SELECT COUNT(*) as count FROM quotations WHERE status = 'rejected'`;
    const customers = await sql`SELECT COUNT(DISTINCT email) as count FROM quotations`;

    res.json({
      total: parseInt(total[0].count),
      pending: parseInt(pending[0].count),
      confirmed: parseInt(confirmed[0].count),
      rejected: parseInt(rejected[0].count),
      customers: parseInt(customers[0].count),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send notification to quotation users
router.post('/send-notification', authenticateAdmin, upload.single('attachment'), async (req, res) => {
  try {
    const { title, message, sendToAll, userIds } = req.body;

    let recipients = [];
    if (sendToAll === 'true' || sendToAll === true) {
      const users = await sql`SELECT DISTINCT email FROM quotations`;
      recipients = users.map(u => u.email);
    } else if (userIds) {
      const parsedIds = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;
      const users = await sql`SELECT email FROM quotations WHERE id = ANY(${parsedIds})`;
      recipients = users.map(u => u.email);
    }

    if (recipients.length === 0) return res.status(400).json({ error: 'No recipients found' });

    for (const email of recipients) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: title,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      };
      if (req.file) {
        mailOptions.attachments = [{ filename: req.file.originalname, content: req.file.buffer }];
      }
      await transporter.sendMail(mailOptions);
    }

    res.json({ message: 'Notification sent successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
