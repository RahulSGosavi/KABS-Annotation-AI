import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { annotationLoginSchema, annotationSignupSchema } from "@shared/schema";

// Configure multer for PDF uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Serve uploaded files
  // Note: For production, add proper authentication/signed URLs
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(uploadDir, req.path);
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: 'File not found' });
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

      const pdfUrl = `/uploads/${file.filename}`;
      
      const project = await storage.createProject({
        name,
        userId,
        pdfUrl,
        pdfPageCount: "1", // Will be updated when PDF is loaded
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

  return httpServer;
}
