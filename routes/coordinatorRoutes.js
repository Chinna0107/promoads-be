const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const bcrypt = require('bcryptjs');
const { authenticateAdmin } = require('./adminAuth');

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const coordinators = await sql`SELECT id, name, email, mobile, event_name, role, created_at FROM coordinators ORDER BY created_at DESC`;
    res.json(coordinators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, email, password, mobile, eventName, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const coordinator = await sql`
      INSERT INTO coordinators (name, email, password, mobile, event_name, role)
      VALUES (${name}, ${email}, ${hashedPassword}, ${mobile}, ${eventName}, ${role || 'coordinator'})
      RETURNING id, name, email, mobile, event_name, role
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

module.exports = router;
