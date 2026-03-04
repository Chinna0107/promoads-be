-- Add payment_method and coordinator columns to team_registrations table

ALTER TABLE team_registrations 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'upi',
ADD COLUMN IF NOT EXISTS coordinator VARCHAR(255);
