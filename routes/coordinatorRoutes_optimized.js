const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const jwt = require('jsonwebtoken');

// Middleware: Set cache headers
const setCacheHeaders = (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=1800');
  res.set('Content-Encoding', 'gzip');
  next();
};

// Coordinator authentication
const authenticateCoordinator = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    req.coordinator = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Optimized: Pagination helper
const getPaginationParams = (req) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = parseInt(req.query.offset) || 0;
  return { limit, offset };
};

// Optimized: Participants with pagination
router.get('/participants/:eventName', authenticateCoordinator, setCacheHeaders, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    const { limit, offset } = getPaginationParams(req);

    const searchPatterns = [
      decodedEventName,
      decodedEventName.toLowerCase(),
      decodedEventName.replace(/\s+/g, '-').toLowerCase()
    ];

    let participants = [];
    for (const pattern of searchPatterns) {
      // Optimized: SELECT only required fields + pagination
      const [indResult, teamResult] = await Promise.all([
        sql`SELECT id, name, email, roll_no as rollNo FROM individual_registrations 
            WHERE (event_name = ${pattern} OR event_id = ${pattern}) AND paid = true
            LIMIT ${limit} OFFSET ${offset}`,
        sql`SELECT id, leader_name as name, leader_email as email, leader_roll_no as rollNo FROM team_registrations 
            WHERE (event_name = ${pattern} OR event_id = ${pattern}) AND paid = true
            LIMIT ${limit} OFFSET ${offset}`
      ]);

      if (indResult.length > 0 || teamResult.length > 0) {
        participants = [...indResult, ...teamResult];
        break;
      }
    }

    // Optimized: Batch evaluation checks
    const evaluations = await Promise.all(
      participants.map(p => 
        sql`SELECT score FROM evaluations WHERE participant_id = ${p.id} AND event_name = ${decodedEventName} LIMIT 1`
      )
    );

    const result = participants.map((p, i) => ({
      ...p,
      evaluated: evaluations[i].length > 0,
      score: evaluations[i][0]?.score || null
    }));

    res.json({ participants: result, limit, offset, total: result.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optimized: Evaluations with pagination
router.get('/evaluations/:eventName', authenticateCoordinator, setCacheHeaders, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    const { limit, offset } = getPaginationParams(req);

    // Optimized: SELECT only required fields
    const evaluations = await sql`
      SELECT e.id, e.participant_id, e.participant_name as name, e.score, e.jury_member
      FROM evaluations e
      WHERE e.event_name = ${decodedEventName}
      ORDER BY e.score DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    res.json({ evaluations, limit, offset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optimized: Winners with pagination
router.get('/winners/:eventName', authenticateCoordinator, setCacheHeaders, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    const { limit, offset } = getPaginationParams(req);

    // Optimized: SELECT only required fields
    const winners = await sql`
      SELECT e.participant_name as name, e.score, e.jury_member,
             ROW_NUMBER() OVER (ORDER BY e.score DESC) as position
      FROM evaluations e
      WHERE e.event_name = ${decodedEventName}
      ORDER BY e.score DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    res.json({ winners, limit, offset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optimized: Add score
router.post('/add-score', authenticateCoordinator, async (req, res) => {
  try {
    const { participantId, score, eventName, juryMember } = req.body;

    // Optimized: Single query to get name
    const participant = await sql`
      SELECT name FROM individual_registrations WHERE id = ${participantId}
      UNION
      SELECT leader_name as name FROM team_registrations WHERE id = ${participantId}
      LIMIT 1
    `;

    const participantName = participant[0]?.name || 'Unknown';

    const existing = await sql`SELECT id FROM evaluations WHERE participant_id = ${participantId} AND event_name = ${eventName} LIMIT 1`;

    if (existing.length > 0) {
      await sql`UPDATE evaluations SET score = ${score}, jury_member = ${juryMember}, evaluated_at = NOW() WHERE participant_id = ${participantId} AND event_name = ${eventName}`;
    } else {
      await sql`INSERT INTO evaluations (participant_id, participant_name, event_name, score, jury_member, evaluated_at) VALUES (${participantId}, ${participantName}, ${eventName}, ${score}, ${juryMember}, NOW())`;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Optimized: Event stats
router.get('/event-stats/:eventName', authenticateCoordinator, setCacheHeaders, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);

    // Optimized: Batch queries
    const [indTotal, teamTotal, indAttended, teamAttended] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM individual_registrations WHERE event_name = ${decodedEventName} AND paid = true`,
      sql`SELECT COUNT(*) as count FROM team_registrations WHERE event_name = ${decodedEventName} AND paid = true`,
      sql`SELECT COUNT(*) as count FROM individual_registrations WHERE event_name = ${decodedEventName} AND present = true AND paid = true`,
      sql`SELECT COUNT(*) as count FROM team_registrations WHERE event_name = ${decodedEventName} AND present = true AND paid = true`
    ]);

    const totalParticipants = parseInt(indTotal[0].count) + parseInt(teamTotal[0].count);
    const attended = parseInt(indAttended[0].count) + parseInt(teamAttended[0].count);

    res.json({ totalParticipants, attended, absent: totalParticipants - attended });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
