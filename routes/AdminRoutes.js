const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const { authenticateAdmin } = require('./adminAuth');
const nodemailer = require('nodemailer');
const multer = require('multer');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// TRI-COD 2K26 Admin Routes - Updated
const storage = multer.memoryStorage();
const upload = multer({ storage });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

router.get('/events', authenticateAdmin, async (req, res) => {
  try {
    const events = await sql`SELECT DISTINCT event_id, event_name FROM individual_registrations
                              UNION
                              SELECT DISTINCT event_id, event_name FROM team_registrations`;
    res.json(events.map(e => ({ id: e.event_id, eventId: e.event_id, name: e.event_name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/registrations', authenticateAdmin, async (req, res) => {
  try {
    const individual = await sql`SELECT *, 'individual' as type FROM individual_registrations`;
    const team = await sql`SELECT *, 'team' as type FROM team_registrations`;
    const registrations = [...individual, ...team].sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at));
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/registrations/event/:eventId', authenticateAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    console.log('Fetching registrations for eventId:', eventId);
    
    // First check what events exist
    const allEvents = await sql`SELECT DISTINCT event_id, event_name FROM individual_registrations
                                UNION
                                SELECT DISTINCT event_id, event_name FROM team_registrations`;
    console.log('All events in database:', allEvents);
    
    const individual = await sql`
      SELECT *, 'Individual' as registrationType 
      FROM individual_registrations 
      WHERE event_id = ${eventId}
    `;
    console.log('Individual registrations found:', individual.length);
    
    const teamRaw = await sql`
      SELECT * FROM team_registrations 
      WHERE event_id = ${eventId}
    `;
    console.log('Team registrations found:', teamRaw.length);
    
    // Format team registrations with members array
    const team = teamRaw.map(t => {
      const members = [];
      
      // Add member2 if exists
      if (t.member2_name) {
        members.push({
          name: t.member2_name,
          email: t.member2_email,
          mobile: t.member2_mobile,
          rollNo: t.member2_roll_no,
          year: t.member2_year,
          branch: t.member2_branch,
          college: t.member2_college
        });
      }
      
      // Add member3 if exists
      if (t.member3_name) {
        members.push({
          name: t.member3_name,
          email: t.member3_email,
          mobile: t.member3_mobile,
          rollNo: t.member3_roll_no,
          year: t.member3_year,
          branch: t.member3_branch,
          college: t.member3_college
        });
      }
      
      // Add member4 if exists
      if (t.member4_name) {
        members.push({
          name: t.member4_name,
          email: t.member4_email,
          mobile: t.member4_mobile,
          rollNo: t.member4_roll_no,
          year: t.member4_year,
          branch: t.member4_branch,
          college: t.member4_college
        });
      }
      
      return {
        ...t,
        registrationType: 'Team',
        name: t.leader_name,
        email: t.leader_email,
        mobile: t.leader_mobile,
        rollNo: t.leader_roll_no,
        year: t.leader_year,
        branch: t.leader_branch,
        college: t.leader_college,
        teamName: t.team_name,
        paid: t.paid || false,
        members
      };
    });
    
    // Format individual registrations to include rollNo, year, branch, paid
    const formattedIndividual = individual.map(i => ({
      ...i,
      rollNo: i.roll_no,
      year: i.year,
      branch: i.branch,
      paid: i.paid || false
    }));
    
    const registrations = [...formattedIndividual, ...team].sort((a, b) => 
      new Date(b.registered_at) - new Date(a.registered_at)
    );
    
    console.log('Total registrations returned:', registrations.length);
    res.json(registrations);
  } catch (error) {
    console.error('Error fetching event registrations:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/users/all', authenticateAdmin, async (req, res) => {
  try {
    const individual = await sql`SELECT id, name, email, roll_no, year, branch FROM individual_registrations`;
    const team = await sql`SELECT id, leader_name as name, leader_email as email, leader_roll_no as roll_no, leader_year as year, leader_branch as branch FROM team_registrations`;
    const users = [...individual, ...team];
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const individual = await sql`SELECT id, name, email, roll_no, year, branch FROM individual_registrations`;
    const team = await sql`SELECT id, leader_name as name, leader_email as email, leader_roll_no as roll_no, leader_year as year, leader_branch as branch FROM team_registrations`;
    const users = [...individual, ...team];
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/send-notification', authenticateAdmin, upload.single('attachment'), async (req, res) => {
  try {
    const { title, message, sendToAll, userIds } = req.body;
    
    let recipients = [];
    if (sendToAll === 'true' || sendToAll === true) {
      const individual = await sql`SELECT email FROM individual_registrations`;
      const team = await sql`SELECT leader_email as email FROM team_registrations`;
      recipients = [...individual, ...team].map(u => u.email);
    } else if (userIds && userIds.length > 0) {
      const parsedIds = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;
      if (parsedIds.length > 0) {
        const individual = await sql`SELECT email FROM individual_registrations WHERE id = ANY(${parsedIds})`;
        const team = await sql`SELECT leader_email as email FROM team_registrations WHERE id = ANY(${parsedIds})`;
        recipients = [...individual, ...team].map(u => u.email);
      }
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found' });
    }

    for (const email of recipients) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: title,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      };

      if (req.file) {
        mailOptions.attachments = [{
          filename: req.file.originalname,
          content: req.file.buffer
        }];
      }

      await transporter.sendMail(mailOptions);
    }

    res.json({ message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/notifications/send', authenticateAdmin, upload.single('attachment'), async (req, res) => {
  try {
    const { title, message, sendToAll, userIds } = req.body;
    
    let recipients = [];
    if (sendToAll === 'true' || sendToAll === true) {
      const individual = await sql`SELECT email FROM individual_registrations`;
      const team = await sql`SELECT leader_email as email FROM team_registrations`;
      recipients = [...individual, ...team].map(u => u.email);
    } else {
      const parsedIds = typeof userIds === 'string' ? JSON.parse(userIds) : userIds;
      const individual = await sql`SELECT email FROM individual_registrations WHERE id IN ${sql(parsedIds)}`;
      const team = await sql`SELECT leader_email as email FROM team_registrations WHERE id IN ${sql(parsedIds)}`;
      recipients = [...individual, ...team].map(u => u.email);
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No recipients found' });
    }

    for (const email of recipients) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: title,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      };

      if (req.file) {
        mailOptions.attachments = [{
          filename: req.file.originalname,
          content: req.file.buffer
        }];
      }

      await transporter.sendMail(mailOptions);
    }

    res.json({ message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/payment-status/:userId', authenticateAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { paymentStatus } = req.body;
    const isPaid = paymentStatus === 'paid';
    
    await sql`UPDATE individual_registrations SET paid = ${isPaid} WHERE id = ${userId}`;
    await sql`UPDATE team_registrations SET paid = ${isPaid} WHERE id = ${userId}`;
    
    res.json({ message: 'Payment status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/excel/:eventId', authenticateAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const individual = await sql`SELECT * FROM individual_registrations WHERE event_id = ${eventId}`;
    const team = await sql`SELECT * FROM team_registrations WHERE event_id = ${eventId}`;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registrations');
    
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Roll No', key: 'rollNo', width: 15 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Branch', key: 'branch', width: 15 },
      { header: 'Mobile', key: 'mobile', width: 15 },
      { header: 'College', key: 'college', width: 25 },
      { header: 'Team', key: 'team', width: 20 },
      { header: 'Role', key: 'role', width: 12 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Coordinator', key: 'coordinator', width: 20 }
    ];
    
    individual.forEach(reg => {
      worksheet.addRow({
        name: reg.name,
        email: reg.email,
        rollNo: reg.roll_no,
        year: reg.year,
        branch: reg.branch,
        mobile: reg.mobile,
        college: reg.college,
        team: '-',
        role: 'Individual',
        paymentMethod: reg.payment_method || 'UPI',
        coordinator: reg.coordinator || '-'
      });
    });
    
    team.forEach(reg => {
      worksheet.addRow({
        name: reg.leader_name,
        email: reg.leader_email,
        rollNo: reg.leader_roll_no,
        year: reg.leader_year,
        branch: reg.leader_branch,
        mobile: reg.leader_mobile,
        college: reg.leader_college,
        team: reg.team_name,
        role: 'Leader',
        paymentMethod: reg.payment_method || 'UPI',
        coordinator: reg.coordinator || '-'
      });
      
      if (reg.member2_name) {
        worksheet.addRow({
          name: reg.member2_name,
          email: reg.member2_email,
          rollNo: reg.member2_roll_no,
          year: reg.member2_year,
          branch: reg.member2_branch,
          mobile: reg.member2_mobile,
          college: reg.member2_college,
          team: reg.team_name,
          role: 'Member',
          paymentMethod: '-',
          coordinator: '-'
        });
      }
      if (reg.member3_name) {
        worksheet.addRow({
          name: reg.member3_name,
          email: reg.member3_email,
          rollNo: reg.member3_roll_no,
          year: reg.member3_year,
          branch: reg.member3_branch,
          mobile: reg.member3_mobile,
          college: reg.member3_college,
          team: reg.team_name,
          role: 'Member',
          paymentMethod: '-',
          coordinator: '-'
        });
      }
      if (reg.member4_name) {
        worksheet.addRow({
          name: reg.member4_name,
          email: reg.member4_email,
          rollNo: reg.member4_roll_no,
          year: reg.member4_year,
          branch: reg.member4_branch,
          mobile: reg.member4_mobile,
          college: reg.member4_college,
          team: reg.team_name,
          role: 'Member',
          paymentMethod: '-',
          coordinator: '-'
        });
      }
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=registrations.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/export/pdf/:eventId', authenticateAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const individual = await sql`SELECT * FROM individual_registrations WHERE event_id = ${eventId}`;
    const team = await sql`SELECT * FROM team_registrations WHERE event_id = ${eventId}`;
    
    const doc = new PDFDocument({ margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=registrations.pdf');
    
    doc.pipe(res);
    
    doc.fontSize(16).text('Event Registrations', { align: 'center' });
    doc.moveDown();
    
    // Table headers
    const headers = ['Name', 'Email', 'Roll No', 'Year', 'Branch', 'Mobile', 'College', 'Team', 'Role'];
    let y = doc.y;
    
    headers.forEach((header, i) => {
      doc.fontSize(10).text(header, 30 + i * 60, y, { width: 55 });
    });
    
    doc.moveDown();
    
    // Individual registrations
    individual.forEach(reg => {
      y = doc.y;
      const data = [reg.name, reg.email, reg.roll_no, reg.year, reg.branch, reg.mobile, reg.college, '-', 'Individual'];
      data.forEach((item, i) => {
        doc.fontSize(8).text(item || '-', 30 + i * 60, y, { width: 55 });
      });
      doc.moveDown(0.5);
    });
    
    // Team registrations
    team.forEach(reg => {
      // Leader
      y = doc.y;
      const leaderData = [reg.leader_name, reg.leader_email, reg.leader_roll_no, reg.leader_year, reg.leader_branch, reg.leader_mobile, reg.leader_college, reg.team_name, 'Leader'];
      leaderData.forEach((item, i) => {
        doc.fontSize(8).text(item || '-', 30 + i * 60, y, { width: 55 });
      });
      doc.moveDown(0.5);
      
      // Members
      [2, 3, 4].forEach(num => {
        if (reg[`member${num}_name`]) {
          y = doc.y;
          const memberData = [reg[`member${num}_name`], reg[`member${num}_email`], reg[`member${num}_roll_no`], reg[`member${num}_year`], reg[`member${num}_branch`], reg[`member${num}_mobile`], reg[`member${num}_college`], reg.team_name, 'Member'];
          memberData.forEach((item, i) => {
            doc.fontSize(8).text(item || '-', 30 + i * 60, y, { width: 55 });
          });
          doc.moveDown(0.5);
        }
      });
    });
    
    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/winners', authenticateAdmin, async (req, res) => {
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

router.get('/winners/:eventName', authenticateAdmin, async (req, res) => {
  try {
    const { eventName } = req.params;
    const decodedEventName = decodeURIComponent(eventName);
    
    // Use case-insensitive search to match any event name format
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
      WHERE LOWER(e.event_name) = LOWER(${decodedEventName})
      ORDER BY e.score DESC
    `;
    
    res.json(winners);
  } catch (error) {
    console.error('Error fetching winners:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;