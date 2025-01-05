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

  // If needed, add custom methods or queries
}
