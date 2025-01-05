// src/app/core/services/section-texts.service.ts
import { Injectable } from '@angular/core';
import { SupabaseTableService } from './supabase-table.service';
import { SupabaseService } from './supabase.service';
import { DateGroup } from '../models/date-group.model';

@Injectable({
  providedIn: 'root',
})
export class DateGroupService extends SupabaseTableService<DateGroup> {
  protected tableName = 'date_group';

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }

  override async getAll(): Promise<DateGroup[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*, date_group_type(*)')
      .order('date_group_type_id', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
  // Example: we might add a method to reorder sequences in a transaction
  // or just update them individually when we swap.
}
