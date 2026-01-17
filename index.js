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
      "https://trishna-codeathon.vercel.app",
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

app.get('/', (req, res) => {
  res.send('✅ TRI-COD 2K26 Backend Running Successfully!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
