-- Add payment_method and coordinator columns to individual_registrations table

ALTER TABLE individual_registrations 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'upi',
ADD COLUMN IF NOT EXISTS coordinator VARCHAR(255);
