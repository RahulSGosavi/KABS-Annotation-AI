import { 
  users, projects, annotations,
  type User, type InsertUser, 
  type Project, type InsertProject,
  type Annotation, type InsertAnnotation 
} from "../../shared/schema";
import { supabase } from "./supabase";

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

export class SupabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    return data as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !data) return undefined;
    return data as User;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .insert(insertUser)
      .select()
      .single();
    
    if (error) throw error;
    return data as User;
  }

  // Project operations
  async getProject(id: string): Promise<Project | undefined> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return undefined;
    return data as Project;
  }

  async getProjectsByUserId(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('userId', userId)
      .order('lastUpdated', { ascending: false });
    
    if (error) throw error;
    return data as Project[];
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...insertProject, lastUpdated: new Date() })
      .select()
      .single();
    
    if (error) throw error;
    return data as Project;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const { data, error } = await supabase
      .from('projects')
      .update({ ...updates, lastUpdated: new Date() })
      .eq('id', id)
      .select()
      .single();
    
    if (error || !data) return undefined;
    return data as Project;
  }

  async deleteProject(id: string): Promise<void> {
    // Delete annotations first
    await supabase
      .from('annotations')
      .delete()
      .eq('projectId', id);
    
    // Then delete project
    await supabase
      .from('projects')
      .delete()
      .eq('id', id);
  }

  // Annotation operations
  async getAnnotation(projectId: string, pageNumber: string): Promise<Annotation | undefined> {
    const { data, error } = await supabase
      .from('annotations')
      .select('*')
      .eq('projectId', projectId)
      .eq('pageNumber', pageNumber)
      .single();
    
    if (error || !data) return undefined;
    return data as Annotation;
  }

  async saveAnnotation(insertAnnotation: InsertAnnotation): Promise<Annotation> {
    const existing = await this.getAnnotation(
      insertAnnotation.projectId, 
      insertAnnotation.pageNumber
    );
    
    if (existing) {
      const { data, error } = await supabase
        .from('annotations')
        .update({ data: insertAnnotation.data, lastUpdated: new Date() })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Annotation;
    }
    
    const { data, error } = await supabase
      .from('annotations')
      .insert(insertAnnotation)
      .select()
      .single();
    
    if (error) throw error;
    return data as Annotation;
  }

  async updateAnnotation(projectId: string, pageNumber: string, data: unknown): Promise<Annotation | undefined> {
    const existing = await this.getAnnotation(projectId, pageNumber);
    
    if (existing) {
      const { data: updated, error } = await supabase
        .from('annotations')
        .update({ data, lastUpdated: new Date() })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (error || !updated) return undefined;
      return updated as Annotation;
    }
    
    const { data: annotation, error } = await supabase
      .from('annotations')
      .insert({ projectId, pageNumber, data })
      .select()
      .single();
    
    if (error) throw error;
    return annotation as Annotation;
  }
}

export const storage = new SupabaseStorage();
