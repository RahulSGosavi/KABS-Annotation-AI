-- Test query to check current schema
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'projects', 'annotations') 
ORDER BY table_name, ordinal_position;

-- Test if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'projects', 'annotations');
