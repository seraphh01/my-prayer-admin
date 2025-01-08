// src/app/core/services/section-texts.service.ts
import { Injectable } from '@angular/core';
import { SupabaseTableService } from './supabase-table.service';
import { SupabaseService } from './supabase.service';
import { SectionText } from '../models/section-text.model';

@Injectable({
  providedIn: 'root',
})
export class SectionTextsService extends SupabaseTableService<SectionText> {
  protected tableName = 'section_texts';

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }

  override async create(item: Partial<SectionText>): Promise<SectionText> {
      const { data, error } = await this.client
        .from(this.tableName)
        .insert([item])
        .select("*, text: liturgical_texts(*)")
        .single();
  
      if (error) throw error;
      return data as SectionText;
    
  }

  // Example: we might add a method to reorder sequences in a transaction
  // or just update them individually when we swap.
}
