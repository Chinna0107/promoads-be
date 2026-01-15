const express = require('express');
const router = express.Router();
const { sql } = require('../db');

router.get('/', async (req, res) => {
  try {
    const events = await sql`SELECT DISTINCT event_id, event_name FROM individual_registrations
                              UNION
                              SELECT DISTINCT event_id, event_name FROM team_registrations`;
    res.json(events.map(e => ({ id: e.event_id, eventId: e.event_id, name: e.event_name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
