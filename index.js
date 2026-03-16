require('dotenv').config();
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/AdminRoutes');
const participantRoutes = require('./routes/participantRoutes');
const eventRoutes = require('./routes/eventRoutes');
const coordinatorRoutes = require('./routes/coordinatorRoutes');
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
app.use('/api/coordinators', coordinatorRoutes);
app.use('/api/contact', contactRoutes);

app.get('/api/participant', async (req, res) => {
  const { roll } = req.query;
  if (!roll) return res.status(400).json({ error: 'Roll number required' });

  try {
    const { sql } = require('./db');

    const individual = await sql`
      SELECT id, name, roll_no, year, branch, college, email, mobile, event_name, payment_status, paid
      FROM individual_registrations WHERE roll_no = ${roll} AND paid = true LIMIT 1
    `;

    const team = await sql`
      SELECT id, leader_name as name, leader_roll_no as roll_no, leader_year as year, leader_branch as branch,
             leader_college as college, leader_email as email, leader_mobile as mobile,
             event_name, payment_status, paid, team_name
      FROM team_registrations WHERE leader_roll_no = ${roll} AND paid = true LIMIT 1
    `;

    const teamMember = await sql`
      SELECT id, team_name, event_name, payment_status, paid,
        CASE
          WHEN member2_roll_no = ${roll} THEN member2_name
          WHEN member3_roll_no = ${roll} THEN member3_name
          WHEN member4_roll_no = ${roll} THEN member4_name
        END as name,
        CASE
          WHEN member2_roll_no = ${roll} THEN member2_roll_no
          WHEN member3_roll_no = ${roll} THEN member3_roll_no
          WHEN member4_roll_no = ${roll} THEN member4_roll_no
        END as roll_no,
        CASE
          WHEN member2_roll_no = ${roll} THEN member2_year
          WHEN member3_roll_no = ${roll} THEN member3_year
          WHEN member4_roll_no = ${roll} THEN member4_year
        END as year,
        CASE
          WHEN member2_roll_no = ${roll} THEN member2_branch
          WHEN member3_roll_no = ${roll} THEN member3_branch
          WHEN member4_roll_no = ${roll} THEN member4_branch
        END as branch,
        CASE
          WHEN member2_roll_no = ${roll} THEN member2_college
          WHEN member3_roll_no = ${roll} THEN member3_college
          WHEN member4_roll_no = ${roll} THEN member4_college
        END as college,
        CASE
          WHEN member2_roll_no = ${roll} THEN member2_email
          WHEN member3_roll_no = ${roll} THEN member3_email
          WHEN member4_roll_no = ${roll} THEN member4_email
        END as email,
        CASE
          WHEN member2_roll_no = ${roll} THEN member2_mobile
          WHEN member3_roll_no = ${roll} THEN member3_mobile
          WHEN member4_roll_no = ${roll} THEN member4_mobile
        END as mobile
      FROM team_registrations
      WHERE (member2_roll_no = ${roll} OR member3_roll_no = ${roll} OR member4_roll_no = ${roll})
      AND paid = true LIMIT 1
    `;

    const p = individual[0] || team[0] || teamMember[0];
    if (!p) return res.status(404).json({ error: 'Participant not found or payment not completed' });

    res.json({
      name: p.name,
      roll: p.roll_no,
      year: p.year,
      department: p.branch,
      college: p.college,
      event: p.event_name,
      email: p.email,
      mobile: p.mobile,
      registrationId: `REG-${p.roll_no}-${p.id}`,
      paymentStatus: p.paid ? 'Completed' : 'Pending',
      teamName: team[0] ? team[0].team_name : null
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
