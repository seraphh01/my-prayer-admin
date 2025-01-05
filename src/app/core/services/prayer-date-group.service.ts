// src/app/core/services/section-texts.service.ts
import { Injectable } from '@angular/core';
import { SupabaseTableService } from './supabase-table.service';
import { SupabaseService } from './supabase.service';
import { SectionText } from '../models/section-text.model';
import { PrayerDateGroup } from '../models/prayer-date-group.model';

@Injectable({
  providedIn: 'root',
})
export class PryaerDateGroupService extends SupabaseTableService<PrayerDateGroup> {
  protected tableName = 'prayer_date_group';

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }

  override async create(item: Partial<PrayerDateGroup>): Promise<PrayerDateGroup> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert([item])
      .select('*, date_group(*, date_group_type(*))')
      .single();

    if (error) throw error;
    return data;
  }

  // Example: we might add a method to reorder sequences in a transaction
  // or just update them individually when we swap.
}
