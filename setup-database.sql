-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  userId VARCHAR NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  pdfUrl TEXT NOT NULL,
  pdfPageCount TEXT NOT NULL DEFAULT '1',
  currentPage TEXT NOT NULL DEFAULT '1',
  lastUpdated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create annotations table
CREATE TABLE IF NOT EXISTS annotations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  projectId VARCHAR NOT NULL,
  pageNumber TEXT NOT NULL,
  data JSONB NOT NULL,
  lastUpdated TIMESTAMP NOT NULL DEFAULT NOW()
);
