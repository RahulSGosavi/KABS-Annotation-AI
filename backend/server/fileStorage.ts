import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'project-files';

export class SupabaseFileStorage {
  async uploadPDF(file: Buffer, filename: string, projectId: string): Promise<string> {
    const filePath = `${projectId}/${filename}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    
    return publicUrl;
  }

  async uploadPageImage(imageBuffer: Buffer, projectId: string, pageNumber: number): Promise<string> {
    const filePath = `${projectId}/pages/page-${pageNumber}.png`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    
    return publicUrl;
  }

  async deleteProjectFiles(projectId: string): Promise<void> {
    const { data: files } = await supabase.storage
      .from(BUCKET_NAME)
      .list(projectId);
    
    if (files && files.length > 0) {
      const filePaths = files.map(file => `${projectId}/${file.name}`);
      
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filePaths);
      
      if (error) throw error;
    }
  }

  async getPageImageUrls(projectId: string): Promise<string[]> {
    const { data: files } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`${projectId}/pages`);
    
    if (!files) return [];
    
    return files
      .filter(file => file.name.startsWith('page-') && file.name.endsWith('.png'))
      .sort((a, b) => {
        const aNum = parseInt(a.name.match(/page-(\d+)\.png$/)?.[1] || '0');
        const bNum = parseInt(b.name.match(/page-(\d+)\.png$/)?.[1] || '0');
        return aNum - bNum;
      })
      .map(file => {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(`${projectId}/pages/${file.name}`);
        return publicUrl;
      });
  }
}

export const fileStorage = new SupabaseFileStorage();
