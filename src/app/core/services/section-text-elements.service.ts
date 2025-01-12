// src/app/core/services/section-texts.service.ts
import { Injectable } from '@angular/core';
import { SupabaseTableService } from './supabase-table.service';
import { SupabaseService } from './supabase.service';
import { SectionText, SectionTextElement } from '../models/section-text.model';

@Injectable({
  providedIn: 'root',
})
export class SectionTextElementsService extends SupabaseTableService<SectionTextElement> {
  protected tableName = 'section_text_elements';

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }
  // Example: we might add a method to reorder sequences in a transaction
  // or just update them individually when we swap.
}
