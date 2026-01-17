CREATE TABLE evaluations (
  id SERIAL PRIMARY KEY,
  participant_id INTEGER NOT NULL,
  participant_name VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  jury_member VARCHAR(255),
  evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(participant_id, event_name)
);