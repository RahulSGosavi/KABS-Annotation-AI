import { 
  users, projects, annotations,
  type User, type InsertUser, 
  type Project, type InsertProject,
  type Annotation, type InsertAnnotation 
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Project operations
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByUserId(userId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;
  
  // Annotation operations
  getAnnotation(projectId: string, pageNumber: string): Promise<Annotation | undefined>;
  saveAnnotation(annotation: InsertAnnotation): Promise<Annotation>;
  updateAnnotation(projectId: string, pageNumber: string, data: unknown): Promise<Annotation | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Project operations
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    return db.select().from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.lastUpdated));
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const [project] = await db.update(projects)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(annotations).where(eq(annotations.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Annotation operations
  async getAnnotation(projectId: string, pageNumber: string): Promise<Annotation | undefined> {
    const [annotation] = await db.select().from(annotations)
      .where(and(
        eq(annotations.projectId, projectId),
        eq(annotations.pageNumber, pageNumber)
      ));
    return annotation || undefined;
  }

  async saveAnnotation(insertAnnotation: InsertAnnotation): Promise<Annotation> {
    const existing = await this.getAnnotation(
      insertAnnotation.projectId, 
      insertAnnotation.pageNumber
    );
    
    if (existing) {
      const [updated] = await db.update(annotations)
        .set({ data: insertAnnotation.data, lastUpdated: new Date() })
        .where(eq(annotations.id, existing.id))
        .returning();
      return updated;
    }
    
    const [annotation] = await db.insert(annotations).values(insertAnnotation).returning();
    return annotation;
  }

  async updateAnnotation(projectId: string, pageNumber: string, data: unknown): Promise<Annotation | undefined> {
    const existing = await this.getAnnotation(projectId, pageNumber);
    
    if (existing) {
      const [updated] = await db.update(annotations)
        .set({ data, lastUpdated: new Date() })
        .where(eq(annotations.id, existing.id))
        .returning();
      return updated;
    }
    
    const [annotation] = await db.insert(annotations)
      .values({ projectId, pageNumber, data })
      .returning();
    return annotation;
  }
}

export const storage = new DatabaseStorage();
