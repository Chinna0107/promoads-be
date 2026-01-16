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
    
    const individual = await sql`
      SELECT name as "participantName", email as "participantId", registered_at as timestamp
      FROM individual_registrations 
      WHERE event_name = ${eventName} AND present = true
    `;
    
    const team = await sql`
      SELECT leader_name as "participantName", leader_email as "participantId", registered_at as timestamp
      FROM team_registrations 
      WHERE event_name = ${eventName} AND present = true
    `;
    
    const attendance = [...individual, ...team].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
