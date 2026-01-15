const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { verifyToken } = require('../middleware/auth');

router.get('/registrations', verifyToken, async (req, res) => {
  try {
    const { email } = req.query;
    const individual = await sql`SELECT event_id, event_name as "eventName", name, email, mobile, college, transaction_id as "transactionId", registered_at as "createdAt", 'Individual' as "registrationType" FROM individual_registrations WHERE email = ${email}`;
    const team = await sql`SELECT event_id, event_name as "eventName", team_name as "teamName", leader_name as name, leader_email as email, leader_mobile as mobile, leader_college as college, transaction_id as "transactionId", registered_at as "createdAt", 'Team' as "registrationType" FROM team_registrations WHERE leader_email = ${email}`;
    const registrations = [...individual, ...team];
    res.json({ registrations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
