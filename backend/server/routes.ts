import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fileStorage } from "./fileStorage";
import multer from "multer";
import bcrypt from "bcryptjs";
import { annotationLoginSchema, annotationSignupSchema } from "../../shared/schema";

// Configure multer for PDF uploads (using memory storage for Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Database diagnostic endpoint
  app.get('/api/db-test', async (req, res) => {
    try {
      // Test basic database connection
      const testUser = await storage.getUser('test');
      res.json({ 
        status: 'database-connected', 
        testUser: testUser || 'null',
        timestamp: new Date().toISOString() 
      });
    } catch (error: any) {
      res.status(500).json({ 
        status: 'database-error', 
        error: error.message,
        code: error.code,
        timestamp: new Date().toISOString() 
      });
    }
  });
  
  // Auth routes
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const parsed = annotationSignupSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { name, email, password } = parsed.data;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Hash password before storing
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ name, email, password: hashedPassword });
      
      // Return user without password
      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const parsed = annotationLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { email, password } = parsed.data;
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Check password with bcrypt
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      // Return user without password
      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Project routes
  app.get('/api/projects', async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      const projects = await storage.getProjectsByUserId(userId);
      res.json(projects);
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/projects/:id', async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      console.error('Get project error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects', upload.single('pdf'), async (req, res) => {
    try {
      const { name, userId } = req.body;
      const file = req.file;

      if (!name || !userId || !file) {
        return res.status(400).json({ message: 'Name, userId, and PDF file are required' });
      }

      const projectId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Upload PDF to Supabase Storage
      const pdfUrl = await fileStorage.uploadPDF(file.buffer, `${projectId}.pdf`, projectId);
      
      let pageCount = 1;
      try {
        // For now, we'll skip PDF conversion since it requires local file system
        // In a production environment, you might want to set up a separate conversion service
        pageCount = 1; // Default to 1 page
      } catch (conversionError) {
        console.error('PDF processing failed, defaulting to 1 page:', conversionError);
      }
      
      const project = await storage.createProject({
        name,
        userId,
        pdfUrl,
        pdfPageCount: String(pageCount),
      });

      res.json(project);
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/projects/:id/save', async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, { status: 'saved' });
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      console.error('Save project error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.patch('/api/projects/:id', async (req, res) => {
    try {
      const updates = req.body;
      const project = await storage.updateProject(req.params.id, updates);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      // Delete files from Supabase Storage first
      await fileStorage.deleteProjectFiles(req.params.id);
      
      // Delete project from database
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Annotation routes
  app.get('/api/annotations/:projectId/:pageNumber', async (req, res) => {
    try {
      const { projectId, pageNumber } = req.params;
      const annotation = await storage.getAnnotation(projectId, pageNumber);
      
      if (!annotation) {
        return res.json({ data: null });
      }
      
      res.json(annotation);
    } catch (error) {
      console.error('Get annotation error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/annotations/:projectId/:pageNumber', async (req, res) => {
    try {
      const { projectId, pageNumber } = req.params;
      const { data } = req.body;
      
      const annotation = await storage.updateAnnotation(projectId, pageNumber, data);
      
      // Also update the project's lastUpdated timestamp
      await storage.updateProject(projectId, {});
      
      res.json(annotation);
    } catch (error) {
      console.error('Save annotation error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get page image URL for a project (with lazy conversion for legacy projects)
  app.get('/api/projects/:id/pages/:pageNumber', async (req, res) => {
    try {
      const { id, pageNumber } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (!project.pdfUrl) {
        return res.status(404).json({ message: 'No PDF associated with this project' });
      }
      
      // For now, return the PDF URL since we're not doing page conversion
      // In a production environment, you would implement proper PDF page extraction
      const imageUrl = project.pdfUrl;
      res.json({ imageUrl, pageNumber: parseInt(pageNumber), totalPages: parseInt(project.pdfPageCount || '1') });
    } catch (error) {
      console.error('Get page error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all page images for a project
  app.get('/api/projects/:id/pages', async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (!project.pdfUrl) {
        return res.json({ pages: [], totalPages: 0 });
      }
      
      // For now, return the PDF URL as a single page
      // In a production environment, you would implement proper PDF page extraction
      const pageCount = parseInt(project.pdfPageCount || '1');
      const pages = Array.from({ length: pageCount }, (_, index) => ({
        pageNumber: index + 1,
        imageUrl: project.pdfUrl, // All pages point to the PDF for now
      }));
      
      res.json({ pages, totalPages: pageCount });
    } catch (error) {
      console.error('Get pages error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  return httpServer;
}
