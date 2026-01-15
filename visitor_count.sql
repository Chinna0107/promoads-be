-- Create visitor_count table
CREATE TABLE IF NOT EXISTS visitor_count (
  id INTEGER PRIMARY KEY DEFAULT 1,
  count INTEGER DEFAULT 0,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial row
INSERT INTO visitor_count (id, count) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
