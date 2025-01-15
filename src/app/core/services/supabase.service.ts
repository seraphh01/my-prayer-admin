// src/app/core/services/supabase.service.ts
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment'

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
      {auth: {persistSession: true}}
    );
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  // Method to upload a file to Supabase storage
  async uploadFile(file: File, path: string): Promise<string> {
    try {
      //check if file already exists
      const { data: exists, error: existError } = await this.supabase.storage
        .from('user_upload')
        .exists(path);

      if (existError) throw existError;

      if (exists){
        return `${environment.supabaseUrl}/storage/v1/object/public/user_upload/${path}`;
      }

      const { data, error } = await this.supabase.storage
        .from('user_upload')
        .upload(path, file);

      let url = `${environment.supabaseUrl}/storage/v1/object/public/user_upload/${path}`;

      if (error) throw error;
      return url;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }
}
