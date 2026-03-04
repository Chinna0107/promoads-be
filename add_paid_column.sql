-- Add paid column with default false to individual_registrations and team_registrations tables

ALTER TABLE individual_registrations 
ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false;

ALTER TABLE team_registrations 
ADD COLUMN IF NOT EXISTS paid BOOLEAN DEFAULT false;
