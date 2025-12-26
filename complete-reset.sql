-- COMPLETE DATABASE RESET - This will delete all data and recreate tables

-- Drop all existing tables
DROP TABLE IF EXISTS annotations CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop any cached schema information
DISCARD PLANS;

-- Create users table with correct schema
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL
);

-- Create projects table with correct camelCase column names
CREATE TABLE projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  userId VARCHAR NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  pdfUrl TEXT NOT NULL,
  pdfPageCount TEXT NOT NULL DEFAULT '1',
  currentPage TEXT NOT NULL DEFAULT '1',
  lastUpdated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create annotations table with correct camelCase column names
CREATE TABLE annotations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  projectId VARCHAR NOT NULL,
  pageNumber TEXT NOT NULL,
  data JSONB NOT NULL,
  lastUpdated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add foreign key constraints
ALTER TABLE projects ADD CONSTRAINT fk_projects_userId 
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE annotations ADD CONSTRAINT fk_annotations_projectId 
  FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_projects_userId ON projects(userId);
CREATE INDEX idx_annotations_projectId ON annotations(projectId);
CREATE INDEX idx_annotations_projectPage ON annotations(projectId, pageNumber);

-- Force Supabase to reload the entire schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the schema was created correctly
SELECT 
  table_name, 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('users', 'projects', 'annotations') 
ORDER BY table_name, ordinal_position;
