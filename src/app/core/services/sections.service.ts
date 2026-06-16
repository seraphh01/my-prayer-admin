// src/app/core/services/sections.service.ts
import { Injectable } from '@angular/core';
import { SupabaseTableService } from './supabase-table.service'; // or your own pattern
import { SupabaseService } from './supabase.service';
import { Section } from '../models/section.model';

@Injectable({
  providedIn: 'root',
})
export class SectionsService extends SupabaseTableService<Section> {
  protected tableName = 'sections';

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }

  override async getPaginated(
    page: number,
    perPage: number,
    filters: { field: string; operator: string; value: unknown }[],
  ): Promise<Section[]> {
    let query = this.client.from(this.tableName).select('*').order('title', { ascending: true });

    for (const filter of filters) {
      query = query.filter(filter.field, filter.operator, filter.value);
    }

    const { data, error } = await query.range((page - 1) * perPage, page * perPage - 1);

    if (error) throw error;
    return data ?? [];
  }

  async countFiltered(filters: { field: string; operator: string; value: unknown }[]): Promise<number> {
    let query = this.client.from(this.tableName).select('*', { count: 'exact', head: true });

    for (const filter of filters) {
      query = query.filter(filter.field, filter.operator, filter.value);
    }

    const { count, error } = await query;

    if (error) throw error;
    return count ?? 0;
  }
}
