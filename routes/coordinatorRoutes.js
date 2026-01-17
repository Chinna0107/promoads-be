const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticateAdmin } = require('./adminAuth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email);
    
    const coordinator = await sql`SELECT * FROM coordinators WHERE email = ${email}`;
    console.log('Coordinator found:', coordinator.length > 0);
    
    if (coordinator.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials - user not found' });
    }
    
    const match = await bcrypt.compare(password, coordinator[0].password);
    console.log('Password match:', match);
    
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials - wrong password' });
    }
    
    const token = jwt.sign(
      { id: coordinator[0].id, email: coordinator[0].email, role: 'coordinator' },
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      coordinator: {
        id: coordinator[0].id,
        name: coordinator[0].name,
        email: coordinator[0].email,
        mobile: coordinator[0].mobile,
        category1: coordinator[0].category1,
        event1: coordinator[0].event1,
        category2: coordinator[0].category2,
        event2: coordinator[0].event2
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const coordinators = await sql`SELECT id, name, email, mobile, category1, event1, category2, event2, role, created_at FROM coordinators ORDER BY created_at DESC`;
    res.json(coordinators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, email, password, mobile, category1, event1, category2, event2, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const coordinator = await sql`
      INSERT INTO coordinators (name, email, password, mobile, category1, event1, category2, event2, role)
      VALUES (${name}, ${email}, ${hashedPassword}, ${mobile}, ${category1}, ${event1}, ${category2 || null}, ${event2 || null}, ${role || 'coordinator'})
      RETURNING id, name, email, mobile, category1, event1, category2, event2, role
    `;
    
    res.json(coordinator[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await sql`DELETE FROM coordinators WHERE id = ${req.params.id}`;
    res.json({ message: 'Coordinator deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/registrations', async (req, res) => {
  try {
    const { eventName } = req.query;
    
    const individual = await sql`
      SELECT *, 'Individual' as registrationType 
      FROM individual_registrations 
      WHERE event_name = ${eventName}
    `;
    
    const team = await sql`
      SELECT *, 'Team' as registrationType, team_name as teamName, leader_email as email, leader_mobile as mobile
      FROM team_registrations 
      WHERE event_name = ${eventName}
    `;
    
    const registrations = [...individual, ...team].sort((a, b) => 
      new Date(b.registered_at) - new Date(a.registered_at)
    );
    
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/my-event', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    
    const coordinator = await sql`SELECT category1, event1, category2, event2 FROM coordinators WHERE id = ${decoded.id}`;
    
    if (coordinator.length === 0) {
      return res.status(404).json({ error: 'Coordinator not found' });
    }
    
    res.json(coordinator[0]);
  } catch (error) {
    console.error('My-event error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/mark-attendance', async (req, res) => {
  try {
    const { email, eventName, present } = req.body;
    console.log('Mark attendance request:', { email, eventName, present });
    
    // Check if participant exists first
    const checkIndividual = await sql`
      SELECT * FROM individual_registrations 
      WHERE email = ${email}
    `;
    const checkTeam = await sql`
      SELECT * FROM team_registrations 
      WHERE leader_email = ${email}
    `;
    
    console.log('Found individual registrations:', checkIndividual.length);
    console.log('Found team registrations:', checkTeam.length);
    
    if (checkIndividual.length > 0) {
      console.log('Individual events:', checkIndividual.map(r => r.event_name));
    }
    if (checkTeam.length > 0) {
      console.log('Team events:', checkTeam.map(r => r.event_name));
    }
    
    const individual = await sql`
      UPDATE individual_registrations 
      SET present = ${present} 
      WHERE LOWER(email) = LOWER(${email}) AND LOWER(event_name) = LOWER(${eventName})
      RETURNING *
    `;
    
    const team = await sql`
      UPDATE team_registrations 
      SET present = ${present} 
      WHERE LOWER(leader_email) = LOWER(${email}) AND LOWER(event_name) = LOWER(${eventName})
      RETURNING *
    `;
    
    if (individual.length === 0 && team.length === 0) {
      return res.status(404).json({ 
        error: 'Participant not found for this event',
        debug: {
          email,
          eventName,
          foundInOtherEvents: checkIndividual.length > 0 || checkTeam.length > 0,
          registeredEvents: [
            ...checkIndividual.map(r => r.event_name),
            ...checkTeam.map(r => r.event_name)
          ]
        }
      });
    }
    
    res.json({ message: 'Attendance marked successfully' });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/attendance/:eventName', async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    console.log('Fetching attendance for event:', decodedEventName);
    
    // Try multiple search patterns like other endpoints
    const searchPatterns = [
      decodedEventName,
      decodedEventName.toLowerCase(),
      decodedEventName.replace(/\s+/g, '-').toLowerCase(),
      decodedEventName.replace(/\s+/g, '_').toLowerCase(),
      // Handle title case variations
      decodedEventName.replace(/\b\w/g, l => l.toUpperCase()),
      // Handle specific case patterns
      // 'Fun Tech (Mind Games)',
      // 'fun tech (mind games)',
      // 'fun-tech-(mind-games)',
      // 'fun_tech_(mind_games)'
    ];
    
    let attendance = [];
    
    for (const pattern of searchPatterns) {
      const individual = await sql`
        SELECT name as "participantName", email as "participantId", registered_at as timestamp
        FROM individual_registrations 
        WHERE (event_name = ${pattern} OR event_id = ${pattern}) AND present = true
      `;
      
      const team = await sql`
        SELECT leader_name as "participantName", leader_email as "participantId", registered_at as timestamp
        FROM team_registrations 
        WHERE (event_name = ${pattern} OR event_id = ${pattern}) AND present = true
      `;
      
      const totalAttendance = [...individual, ...team];
      
      if (totalAttendance.length > 0) {
        console.log(`Found attendance with pattern '${pattern}':`, totalAttendance.length);
        attendance = totalAttendance.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        );
        break;
      }
    }
    
    console.log('Total attendance found:', attendance.length);
    res.json({ attendance });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Coordinator authentication middleware
const authenticateCoordinator = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    req.coordinator = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get coordinator profile
router.get('/profile', authenticateCoordinator, async (req, res) => {
  try {
    const coordinatorId = req.coordinator.id;
    
    const coordinator = await sql`
      SELECT id, name, email, mobile, event1, event2
      FROM coordinators 
      WHERE id = ${coordinatorId}
    `;
    
    if (coordinator.length === 0) {
      return res.status(404).json({ error: 'Coordinator not found' });
    }
    
    const result = {
      ...coordinator[0],
      eventName: coordinator[0].event1,
      events: [coordinator[0].event1, coordinator[0].event2].filter(Boolean)
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching coordinator profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all winners
router.get('/winners', authenticateCoordinator, async (req, res) => {
  try {
    const winners = await sql`
      SELECT 
        e.participant_name as name,
        e.score,
        e.event_name as "eventName",
        COALESCE(i.email, t.leader_email) as email,
        ROW_NUMBER() OVER (PARTITION BY e.event_name ORDER BY e.score DESC) as position
      FROM evaluations e
      LEFT JOIN individual_registrations i ON e.participant_id = i.id
      LEFT JOIN team_registrations t ON e.participant_id = t.id
      ORDER BY e.event_name, e.score DESC
    `;
    
    res.json(winners);
  } catch (error) {
    console.error('Error fetching winners:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get winners for specific event
router.get('/winners/:eventName', authenticateCoordinator, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    
    const winners = await sql`
      SELECT 
        e.participant_name as name,
        e.score,
        e.event_name as "eventName",
        COALESCE(i.email, t.leader_email) as email,
        ROW_NUMBER() OVER (ORDER BY e.score DESC) as position
      FROM evaluations e
      LEFT JOIN individual_registrations i ON e.participant_id = i.id
      LEFT JOIN team_registrations t ON e.participant_id = t.id
      WHERE e.event_name = ${decodedEventName}
      ORDER BY e.score DESC
    `;
    
    res.json(winners);
  } catch (error) {
    console.error('Error fetching winners:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/participants/:eventName', authenticateCoordinator, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    console.log('Raw eventName from URL:', eventName);
    console.log('Decoded eventName:', decodedEventName);
    
    // Check what events and event_ids exist
    const allEvents = await sql`
      SELECT DISTINCT event_name, event_id FROM individual_registrations
      UNION
      SELECT DISTINCT event_name, event_id FROM team_registrations
    `;
    console.log('All events in database:', allEvents);
    
    // Try multiple search patterns
    const searchPatterns = [
      decodedEventName,
      decodedEventName.toLowerCase(),
      decodedEventName.replace(/\s+/g, '-').toLowerCase(),
      decodedEventName.replace(/\s+/g, '_').toLowerCase(),
      // Handle title case variations
      decodedEventName.replace(/\b\w/g, l => l.toUpperCase()),
      // // Handle specific case patterns
      // 'Fun Tech (Mind Games)',
      // 'fun tech (mind games)',
      // 'fun-tech-(mind-games)',
      // 'fun_tech_(mind_games)'
    ];
    
    console.log('Trying search patterns:', searchPatterns);
    
    let individual = [];
    let team = [];
    
    for (const pattern of searchPatterns) {
      const indResult = await sql`
        SELECT id, name, email, roll_no as rollNo, year, branch, college, mobile
        FROM individual_registrations 
        WHERE event_name = ${pattern} OR event_id = ${pattern}
      `;
      
      const teamResult = await sql`
        SELECT id, leader_name as name, leader_email as email, leader_roll_no as rollNo, leader_year as year, leader_branch as branch, leader_college as college, leader_mobile as mobile
        FROM team_registrations 
        WHERE event_name = ${pattern} OR event_id = ${pattern}
      `;
      
      if (indResult.length > 0 || teamResult.length > 0) {
        console.log(`Found participants with pattern '${pattern}':`, indResult.length + teamResult.length);
        individual = indResult;
        team = teamResult;
        break;
      }
    }
    
    console.log('Individual participants found:', individual.length);
    console.log('Team participants found:', team.length);
    
    const participants = [...individual, ...team];
    
    // Get participants with evaluation status
    let participantsWithEvaluation = [];
    
    for (const participant of participants) {
      // Check if this participant has been evaluated
      const evaluation = await sql`
        SELECT score FROM evaluations 
        WHERE participant_id = ${participant.id} AND event_name = ${decodedEventName}
      `;
      
      participantsWithEvaluation.push({
        ...participant,
        evaluated: evaluation.length > 0,
        score: evaluation[0]?.score || null
      });
    }
    
    console.log('Total participants returned:', participantsWithEvaluation.length);
    res.json(participantsWithEvaluation);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/participant/:eventName/:participantName', authenticateCoordinator, async (req, res) => {
  try {
    const { eventName, participantName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    const decodedParticipantName = decodeURIComponent(participantName).replace(/-/g, ' ');
    
    console.log('Fetching participant:', decodedParticipantName, 'for event:', decodedEventName);
    
    // Search for participant by name (case-insensitive)
    const individual = await sql`
      SELECT id, name, email, roll_no as rollNo, year, branch, college, mobile
      FROM individual_registrations 
      WHERE LOWER(name) LIKE LOWER(${'%' + decodedParticipantName + '%'})
      AND (event_name = ${decodedEventName} OR event_id = ${decodedEventName})
    `;
    
    const team = await sql`
      SELECT id, leader_name as name, leader_email as email, leader_roll_no as rollNo, leader_year as year, leader_branch as branch, leader_college as college, leader_mobile as mobile
      FROM team_registrations 
      WHERE LOWER(leader_name) LIKE LOWER(${'%' + decodedParticipantName + '%'})
      AND (event_name = ${decodedEventName} OR event_id = ${decodedEventName})
    `;
    
    const participants = [...individual, ...team];
    
    if (participants.length === 0) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    
    const participant = participants[0];
    
    // Check if this participant has been evaluated
    const evaluation = await sql`
      SELECT score FROM evaluations 
      WHERE participant_id = ${participant.id} AND event_name = ${decodedEventName}
    `;
    
    const participantWithEvaluation = {
      ...participant,
      evaluated: evaluation.length > 0,
      score: evaluation[0]?.score || null
    };
    
    res.json(participantWithEvaluation);
  } catch (error) {
    console.error('Error fetching participant:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/evaluations/:eventName', authenticateCoordinator, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    
    console.log('Fetching evaluations for event:', decodedEventName);
    
    // Try multiple search patterns like in other endpoints
    const searchPatterns = [
      decodedEventName,
      decodedEventName.toLowerCase(),
      decodedEventName.replace(/\s+/g, '-').toLowerCase(),
      decodedEventName.replace(/\s+/g, '_').toLowerCase(),
      // Handle title case variations
      decodedEventName.replace(/\b\w/g, l => l.toUpperCase()),
      // // Handle specific case patterns
      // 'Fun Tech (Mind Games)',
      // 'fun tech (mind games)',
      // 'fun-tech-(mind-games)',
      // 'fun_tech_(mind_games)'
    ];
    
    let evaluations = [];
    
    for (const pattern of searchPatterns) {
      const result = await sql`
        SELECT 
          e.id,
          e.participant_id,
          e.participant_name as name,
          e.score,
          e.evaluated_at as "evaluatedAt",
          COALESCE(i.email, t.leader_email) as email,
          COALESCE(i.roll_no, t.leader_roll_no) as "rollNo"
        FROM evaluations e
        LEFT JOIN individual_registrations i ON e.participant_id = i.id
        LEFT JOIN team_registrations t ON e.participant_id = t.id
        WHERE e.event_name = ${pattern}
        ORDER BY e.score DESC
      `;
      
      if (result.length > 0) {
        console.log(`Found evaluations with pattern '${pattern}':`, result.length);
        evaluations = result;
        break;
      }
    }
    
    console.log('Evaluations found:', evaluations.length);
    res.json(evaluations);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/export-evaluations/excel/:eventName', authenticateCoordinator, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    
    const evaluations = await sql`
      SELECT 
        e.participant_name as name,
        e.score,
        e.evaluated_at
      FROM evaluations e
      WHERE e.event_name = ${decodedEventName}
      ORDER BY e.score DESC
    `;
    
    if (evaluations.length === 0) {
      return res.json({ message: 'No evaluations found for this event' });
    }
    
    // Simple CSV format
    let csv = 'Rank,Name,Score,Date\n';
    evaluations.forEach((evaluation, index) => {
      const date = evaluation.evaluated_at ? new Date(evaluation.evaluated_at).toLocaleDateString() : 'N/A';
      csv += `${index + 1},"${evaluation.name}",${evaluation.score},"${date}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="evaluations.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/export-evaluations/pdf/:eventName', authenticateCoordinator, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    
    const evaluations = await sql`
      SELECT 
        e.participant_name as name,
        e.score,
        e.evaluated_at
      FROM evaluations e
      WHERE e.event_name = ${decodedEventName}
      ORDER BY e.score DESC
    `;
    
    if (evaluations.length === 0) {
      return res.json({ message: 'No evaluations found for this event' });
    }
    
    // Simple text format
    let text = `${decodedEventName} - Evaluation Results\n\n`;
    text += 'Rank\tName\t\t\tScore\n';
    text += '----\t----\t\t\t-----\n';
    
    evaluations.forEach((evaluation, index) => {
      const name = evaluation.name.padEnd(20);
      text += `${index + 1}\t${name}\t${evaluation.score}\n`;
    });
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="evaluations.txt"');
    res.send(text);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/add-score', authenticateCoordinator, async (req, res) => {
  try {
    const { participantId, score, eventName, juryMember } = req.body;
    console.log('Adding score:', { participantId, score, eventName, juryMember });
    
    // Get participant name
    const participant = await sql`
      SELECT name FROM individual_registrations WHERE id = ${participantId}
      UNION
      SELECT leader_name as name FROM team_registrations WHERE id = ${participantId}
    `;
    
    const participantName = participant[0]?.name || 'Unknown';
    console.log('Participant name:', participantName);
    
    // Check if evaluation already exists
    const existing = await sql`
      SELECT id FROM evaluations 
      WHERE participant_id = ${participantId} AND event_name = ${eventName}
    `;
    
    if (existing.length > 0) {
      // Update existing
      await sql`
        UPDATE evaluations 
        SET score = ${score}, participant_name = ${participantName}, jury_member = ${juryMember}, evaluated_at = NOW()
        WHERE participant_id = ${participantId} AND event_name = ${eventName}
      `;
      console.log('Updated existing evaluation');
    } else {
      // Insert new
      await sql`
        INSERT INTO evaluations (participant_id, participant_name, event_name, score, jury_member, evaluated_at)
        VALUES (${participantId}, ${participantName}, ${eventName}, ${score}, ${juryMember}, NOW())
      `;
      console.log('Inserted new evaluation');
    }
    
    res.json({ message: 'Score added successfully' });
  } catch (error) {
    console.error('Add score error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/evaluate', authenticateCoordinator, async (req, res) => {
  try {
    const { evaluations } = req.body;
    console.log('Bulk evaluations:', evaluations);
    
    for (const evaluation of evaluations) {
      // Get participant name
      const participant = await sql`
        SELECT name FROM individual_registrations WHERE id = ${evaluation.participantId}
        UNION
        SELECT leader_name as name FROM team_registrations WHERE id = ${evaluation.participantId}
      `;
      
      const participantName = participant[0]?.name || 'Unknown';
      
      // Check if evaluation already exists
      const existing = await sql`
        SELECT id FROM evaluations 
        WHERE participant_id = ${evaluation.participantId} AND event_name = ${evaluation.eventName}
      `;
      
      if (existing.length > 0) {
        // Update existing
        await sql`
          UPDATE evaluations 
          SET score = ${evaluation.score}, participant_name = ${participantName}, evaluated_at = NOW()
          WHERE participant_id = ${evaluation.participantId} AND event_name = ${evaluation.eventName}
        `;
      } else {
        // Insert new
        await sql`
          INSERT INTO evaluations (participant_id, participant_name, event_name, score, evaluated_at)
          VALUES (${evaluation.participantId}, ${participantName}, ${evaluation.eventName}, ${evaluation.score}, NOW())
        `;
      }
    }
    
    res.json({ message: 'Evaluations submitted successfully' });
  } catch (error) {
    console.error('Bulk evaluate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get event stats for live status
router.get('/event-stats/:eventName', authenticateCoordinator, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    console.log('Fetching stats for event:', decodedEventName);
    
    // Try multiple search patterns like in other endpoints
    const searchPatterns = [
      decodedEventName,
      decodedEventName.toLowerCase(),
      decodedEventName.replace(/\s+/g, '-').toLowerCase(),
      decodedEventName.replace(/\s+/g, '_').toLowerCase(),
      // Handle title case variations
      decodedEventName.replace(/\b\w/g, l => l.toUpperCase()),
      // Handle specific case patterns
      // 'Fun Tech (Mind Games)',
      // 'fun tech (mind games)',
      // 'fun-tech-(mind-games)',
      // 'fun_tech_(mind_games)'
    ];
    
    let totalParticipants = 0;
    let attended = 0;
    
    for (const pattern of searchPatterns) {
      // Get total participants
      const individual = await sql`
        SELECT COUNT(*) as count FROM individual_registrations 
        WHERE event_name = ${pattern} OR event_id = ${pattern}
      `;
      
      const team = await sql`
        SELECT COUNT(*) as count FROM team_registrations 
        WHERE event_name = ${pattern} OR event_id = ${pattern}
      `;
      
      const total = parseInt(individual[0].count) + parseInt(team[0].count);
      
      if (total > 0) {
        console.log(`Found participants with pattern '${pattern}':`, total);
        totalParticipants = total;
        
        // Get attended count
        const attendedIndividual = await sql`
          SELECT COUNT(*) as count FROM individual_registrations 
          WHERE (event_name = ${pattern} OR event_id = ${pattern}) AND present = true
        `;
        
        const attendedTeam = await sql`
          SELECT COUNT(*) as count FROM team_registrations 
          WHERE (event_name = ${pattern} OR event_id = ${pattern}) AND present = true
        `;
        
        attended = parseInt(attendedIndividual[0].count) + parseInt(attendedTeam[0].count);
        break;
      }
    }
    
    const absent = totalParticipants - attended;
    
    console.log('Event stats:', { totalParticipants, attended, absent });
    res.json({
      totalParticipants,
      attended,
      absent
    });
  } catch (error) {
    console.error('Error fetching event stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;