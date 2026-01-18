const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { authenticateAdmin } = require('./adminAuth');

// Get all events
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const events = await sql`
      SELECT DISTINCT event_id as _id, event_name as name 
      FROM individual_registrations
      UNION
      SELECT DISTINCT event_id as _id, event_name as name 
      FROM team_registrations
      ORDER BY name
    `;
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get registration count for specific event
router.get('/:eventId/registrations', authenticateAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const individual = await sql`
      SELECT COUNT(*) as count FROM individual_registrations 
      WHERE event_id = ${eventId}
    `;
    
    const team = await sql`
      SELECT COUNT(*) as count FROM team_registrations 
      WHERE event_id = ${eventId}
    `;
    
    const totalCount = parseInt(individual[0].count) + parseInt(team[0].count);
    
    res.json({ count: totalCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get total registration stats
router.get('/stats/total', authenticateAdmin, async (req, res) => {
  try {
    const individual = await sql`SELECT COUNT(*) as count FROM individual_registrations`;
    const team = await sql`SELECT COUNT(*) as count FROM team_registrations`;
    
    const totalRegistrations = parseInt(individual[0].count) + parseInt(team[0].count);
    
    res.json({ 
      total: totalRegistrations,
      individual: parseInt(individual[0].count),
      team: parseInt(team[0].count)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;