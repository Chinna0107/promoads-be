const express = require('express');
const router = express.Router();
const { sql } = require('../db');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    
    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Save contact message to database
    const contact = await sql`
      INSERT INTO contact_messages (name, email, phone, subject, message, created_at)
      VALUES (${name}, ${email}, ${phone || null}, ${subject}, ${message}, NOW())
      RETURNING *
    `;
    
    // Email to admin
    const adminEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #00ff88 0%, #00eaff 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
          <h1 style="color: #000; margin: 0; font-size: 24px;">🎯 New Contact Message - Codeathon 2K26</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Contact Details:</h2>
          
          <div style="margin-bottom: 15px;">
            <strong style="color: #00ff88;">Name:</strong> ${name}
          </div>
          
          <div style="margin-bottom: 15px;">
            <strong style="color: #00ff88;">Email:</strong> ${email}
          </div>
          
          ${phone ? `<div style="margin-bottom: 15px;">
            <strong style="color: #00ff88;">Phone:</strong> ${phone}
          </div>` : ''}
          
          <div style="margin-bottom: 15px;">
            <strong style="color: #00ff88;">Subject:</strong> ${subject}
          </div>
          
          <div style="margin-bottom: 20px;">
            <strong style="color: #00ff88;">Message:</strong>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 10px; border-left: 4px solid #00ff88;">
              ${message}
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="mailto:${email}" style="background: #00ff88; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reply to ${name}
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
          <p>This message was sent from the Codeathon 2K26 contact form.</p>
        </div>
      </div>
    `;
    
    // Email to participant (confirmation)
    const participantEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #00ff88 0%, #00eaff 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
          <h1 style="color: #000; margin: 0; font-size: 24px;">🎯 Thank You for Contacting Us!</h1>
          <p style="color: #000; margin: 10px 0 0 0; opacity: 0.8;">Codeathon 2K26</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333; margin-bottom: 20px;">Hi ${name}! 👋</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            Thank you for reaching out to us regarding <strong>${subject}</strong>. We have received your message and our team will get back to you within 24-48 hours.
          </p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #00ff88; margin: 20px 0;">
            <h3 style="color: #00ff88; margin: 0 0 10px 0;">Your Message:</h3>
            <p style="color: #555; margin: 0; line-height: 1.5;">${message}</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #00ff88 0%, #00eaff 100%); padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #000; margin: 0 0 15px 0;">📞 Need Immediate Help?</h3>
            <div style="color: #000; opacity: 0.9;">
              <p style="margin: 5px 0;">📧 Email: codeathon2k26@gmail.com</p>
              <p style="margin: 5px 0;">📱 Phone: +91 8179860935</p>
              <p style="margin: 5px 0;">🕒 Hours: 9:30 AM - 5:00 PM (Mon-Sat)</p>
            </div>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            In the meantime, feel free to explore our events and stay updated with the latest announcements on our website.
          </p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://codeathon2k26.com" style="background: #00ff88; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px; font-weight: bold;">
              Visit Website
            </a>
            <a href="https://codeathon2k26.com/events" style="background: #00eaff; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              View Events
            </a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
          <p>Best regards,<br><strong>Codeathon 2K26 Team</strong></p>
          <p>Annamacharya Institute of Technology & Sciences</p>
        </div>
      </div>
    `;
    
    // Send email to admin
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL || 'codeathon2k26@gmail.com',
      subject: `🎯 New Contact Message: ${subject} - Codeathon 2K26`,
      html: adminEmailContent
    });
    
    // Send confirmation email to participant
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: '🎯 Thank You for Contacting Codeathon 2K26!',
      html: participantEmailContent
    });
    
    res.json({ 
      message: 'Message sent successfully! We will get back to you soon.',
      contactId: contact[0].id
    });
    
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

module.exports = router;