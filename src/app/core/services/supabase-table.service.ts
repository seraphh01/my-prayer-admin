// src/app/core/services/supabase-table.service.ts
import { SupabaseService } from './supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';

export abstract class SupabaseTableService<T extends { id: string | number }> {
  // Each extending service must specify its table name
  protected abstract tableName: string;

  constructor(protected supabase: SupabaseService) {}

  get client(): SupabaseClient {
    return this.supabase.client;
  }

  /**
   * Fetch all rows from the table.
   * @returns Promise<T[]>
   */
  async getAll(): Promise<T[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  /**
   * Fetch a single record by ID.
   * @param id Primary key
   * @returns Promise<T | null>
   */
  async getById(id: string | number): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create a new record in the table.
   * @param item Partial<T>
   * @returns Promise<T>
   */
  async create(item: Partial<T>): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert([item])
      .select()
      .single();

    if (error) throw error;
    return data as T;
  }

  /**
   * Update an existing record by ID.
   * @param id Primary key
   * @param item Partial<T>
   * @returns Promise<T>
   */
  async update(id: string | number, item: Partial<T>): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update(item)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as T;
  }

  /**
   * Delete a record by ID.
   * @param id Primary key
   */
  async delete(id: string | number): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}
