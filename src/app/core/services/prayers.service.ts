// src/app/core/services/prayers.service.ts
import { Injectable } from '@angular/core';
import { SupabaseTableService } from './supabase-table.service';
import { SupabaseService } from './supabase.service';
import { Prayer } from '../models/prayer.model';

@Injectable({
  providedIn: 'root',
})
export class PrayersService extends SupabaseTableService<Prayer> {
  protected tableName = 'prayers';

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }


  override async getAll(): Promise<Prayer[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order('prayer_type_id', { ascending: true }).order('sequence', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  // If needed, override or add custom methods here.
}
