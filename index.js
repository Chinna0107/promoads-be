require('dotenv').config();
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/admin/adminRoutes');
const participantRoutes = require('./routes/participantRoutes');
const eventRoutes = require('./routes/eventRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/events', eventRoutes);

app.get("/", (req, res) => {
  res.send("✅ TRI-COD 2K26 Backend Running Successfully on Vercel!");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API endpoints:`);
  console.log(`   - Users: http://localhost:${PORT}/api/users`);
  console.log(`   - Admin: http://localhost:${PORT}/api/admin`);
  console.log(`   - Participants: http://localhost:${PORT}/api/participants`);
  console.log(`   - Events: http://localhost:${PORT}/api/events`);
});
