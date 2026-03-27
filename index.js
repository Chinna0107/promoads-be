require('dotenv').config();
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/AdminRoutes');
const participantRoutes = require('./routes/participantRoutes');
const eventRoutes = require('./routes/eventRoutes');
const contactRoutes = require('./routes/contactRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "https://www.codeathon2k26.live",
      "https://trishna-codeathon-git-main-hemanths-projects-89508a02.vercel.app"
    ],
    credentials: true,
  })
);

app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/contact', contactRoutes);

app.get('/api/participant', async (req, res) => {
  const { roll } = req.query;
  if (!roll) return res.status(400).json({ error: 'Roll number required' });
  try {
    const { sql } = require('./db');
    const individual = await sql`
      SELECT id, name, roll_no, year, branch, college, email, mobile, event_name, payment_status
      FROM individual_registrations WHERE roll_no = ${roll} LIMIT 1
    `;
    const p = individual[0];
    if (!p) return res.status(404).json({ error: 'Participant not found' });
    res.json({
      name: p.name, roll: p.roll_no, year: p.year, department: p.branch,
      college: p.college, event: p.event_name, email: p.email, mobile: p.mobile,
      registrationId: `REG-${p.roll_no}-${p.id}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ TRI-COD 2K26 Backend Running Successfully!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
