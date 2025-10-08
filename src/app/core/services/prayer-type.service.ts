// src/app/core/services/prayers.service.ts
import { Injectable } from '@angular/core';
import { SupabaseTableService } from './supabase-table.service';
import { SupabaseService } from './supabase.service';
import { PrayerType } from '../models/prayer-type.model';

@Injectable({
  providedIn: 'root',
})
export class PrayerTypeService extends SupabaseTableService<PrayerType> {
  protected tableName = 'prayer_type';

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }

  /**
   * Fetch all rows from the table.
   * @returns Promise<T[]>
   */
  override async getAll(): Promise<PrayerType[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')

    if (error) throw error;
    return data ?? [];
  }

  async getTree(): Promise<PrayerType[]> {
    const { data, error } = await this.supabase.client
      .functions.invoke('prayer-cache?rpc=get_prayer_types', { method: 'POST', body: {}}); // Name of your function in DB

    if (error) {
      console.error('Error calling get_prayer_types:', error);
      throw error;
    }
    // data should be the JSONB result your function returns
    return data;
  }

  // If needed, override or add custom methods here.
}
