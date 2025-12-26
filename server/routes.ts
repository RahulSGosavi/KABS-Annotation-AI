import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { exec } from "child_process";
import { promisify } from "util";
import { annotationLoginSchema, annotationSignupSchema } from "@shared/schema";

const execAsync = promisify(exec);

function extractPageNumber(filename: string): number {
  const match = filename.match(/page-(\d+)\.png$/);
  return match ? parseInt(match[1], 10) : 0;
}

function sortPageFiles(files: string[]): string[] {
  return files.filter(f => f.startsWith('page-') && f.endsWith('.png'))
    .sort((a, b) => extractPageNumber(a) - extractPageNumber(b));
}

const conversionLocks = new Map<string, Promise<{ pageCount: number; pages: { pageNumber: number; imagePath: string }[] }>>();

async function convertPdfToImages(pdfPath: string, outputDir: string): Promise<{ pageCount: number; pages: { pageNumber: number; imagePath: string }[] }> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPrefix = path.join(outputDir, 'page');
  
  try {
    await execAsync(`pdftoppm -png -r 150 "${pdfPath}" "${outputPrefix}"`);
    
    const files = sortPageFiles(fs.readdirSync(outputDir));
    const pages = files.map((file, index) => ({
      pageNumber: index + 1,
      imagePath: path.join(outputDir, file),
    }));
    
    return { pageCount: pages.length, pages };
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error('Failed to convert PDF to images');
  }
}

async function ensurePageImagesExist(projectId: string, pdfUrl: string): Promise<{ pageCount: number; files: string[] }> {
  const pagesDir = path.join(uploadDir, projectId, 'pages');
  
  if (fs.existsSync(pagesDir)) {
    const files = sortPageFiles(fs.readdirSync(pagesDir));
    if (files.length > 0) {
      return { pageCount: files.length, files };
    }
  }
  
  const lockKey = projectId;
  let conversionPromise = conversionLocks.get(lockKey);
  
  if (!conversionPromise) {
    const pdfFilename = pdfUrl.replace('/uploads/', '');
    const pdfPath = path.join(uploadDir, pdfFilename);
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF file not found');
    }
    
    conversionPromise = convertPdfToImages(pdfPath, pagesDir);
    conversionLocks.set(lockKey, conversionPromise);
    
    conversionPromise.finally(() => {
      conversionLocks.delete(lockKey);
    });
  }
  
  await conversionPromise;
  
  const files = sortPageFiles(fs.readdirSync(pagesDir));
  return { pageCount: files.length, files };
}

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
  
  // Serve uploaded files (PDFs and images)
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(uploadDir, req.path);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
      } else if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (ext === '.jpg' || ext === '.jpeg') {
        res.setHeader('Content-Type', 'image/jpeg');
      }
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
      const pdfPath = path.join(uploadDir, file.filename);
      const projectId = `proj-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const pagesDir = path.join(uploadDir, projectId, 'pages');
      
      let pageCount = 1;
      try {
        const result = await convertPdfToImages(pdfPath, pagesDir);
        pageCount = result.pageCount || 1;
      } catch (conversionError) {
        console.error('PDF conversion failed, defaulting to 1 page:', conversionError);
      }
      
      const project = await storage.createProject({
        name,
        userId,
        pdfUrl,
        pdfPageCount: String(pageCount),
      });

      if (pageCount > 0) {
        const newPagesDir = path.join(uploadDir, project.id, 'pages');
        const newProjectDir = path.join(uploadDir, project.id);
        
        if (!fs.existsSync(newProjectDir)) {
          fs.mkdirSync(newProjectDir, { recursive: true });
        }
        
        if (fs.existsSync(pagesDir) && !fs.existsSync(newPagesDir)) {
          fs.renameSync(pagesDir, newPagesDir);
        }
        
        const tempProjectDir = path.join(uploadDir, projectId);
        if (fs.existsSync(tempProjectDir) && tempProjectDir !== newProjectDir) {
          try {
            fs.rmSync(tempProjectDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.log('Cleanup of temp directory failed (non-critical):', cleanupError);
          }
        }
      }

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

  // Get page image URL for a project (with lazy conversion for legacy projects)
  app.get('/api/projects/:id/pages/:pageNumberZoom', async (req, res) => {
    try {
      const { id, pageNumberZoom } = req.params;
      
      // Extract page number from "page:zoom" format
      const pageNumber = pageNumberZoom.split(':')[0];
      
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if (!project.pdfUrl) {
        return res.status(404).json({ message: 'No PDF associated with this project' });
      }
      
      const { pageCount, files } = await ensurePageImagesExist(id, project.pdfUrl);
      const pageIndex = parseInt(pageNumber) - 1;
      
      if (pageIndex < 0 || pageIndex >= files.length) {
        return res.status(404).json({ message: 'Page not found' });
      }
      
      const imageUrl = `/uploads/${id}/pages/${files[pageIndex]}`;
      res.json({ imageUrl, pageNumber: parseInt(pageNumber), totalPages: pageCount });
    } catch (error) {
      console.error('Get page error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get all page images for a project (with lazy conversion for legacy projects)
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
      
      const { pageCount, files } = await ensurePageImagesExist(id, project.pdfUrl);
      const pages = files.map((file, index) => ({
        pageNumber: index + 1,
        imageUrl: `/uploads/${id}/pages/${file}`,
      }));
      
      res.json({ pages, totalPages: pageCount });
    } catch (error) {
      console.error('Get pages error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  return httpServer;
}
