-- Add test participants for 'Cook without fire' event
INSERT INTO individual_registrations (
  event_id, event_name, name, email, mobile, roll_no, year, branch, college, password, transaction_id
) VALUES 
  ('cook-001', 'Cook without fire', 'Alice Johnson', 'alice@example.com', '9876543210', 'CS101', '2024', 'CSE', 'Test College', 'password123', 'TXN001'),
  ('cook-001', 'Cook without fire', 'Bob Smith', 'bob@example.com', '9876543211', 'CS102', '2024', 'CSE', 'Test College', 'password123', 'TXN002');

INSERT INTO team_registrations (
  event_id, event_name, team_name, leader_name, leader_email, leader_mobile, 
  leader_roll_no, leader_year, leader_branch, leader_college, leader_password,
  member2_name, member2_email, member2_mobile, member2_roll_no, member2_year, member2_branch, member2_college,
  transaction_id, amount
) VALUES (
  'cook-001', 'Cook without fire', 'Master Chefs', 'Charlie Brown', 'charlie@example.com', '9876543212',
  'CS103', '2024', 'CSE', 'Test College', 'password123',
  'Diana Prince', 'diana@example.com', '9876543213', 'CS104', '2024', 'CSE', 'Test College',
  'TXN003', 200
);