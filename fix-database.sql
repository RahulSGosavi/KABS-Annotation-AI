-- Drop existing tables if they exist and recreate with correct column names
DROP TABLE IF EXISTS annotations CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Recreate users table
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL
);

-- Recreate projects table with correct column names
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

-- Recreate annotations table with correct column names
CREATE TABLE annotations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  projectId VARCHAR NOT NULL,
  pageNumber TEXT NOT NULL,
  data JSONB NOT NULL,
  lastUpdated TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
