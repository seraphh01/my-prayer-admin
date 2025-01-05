// src/app/core/services/liturgical-texts.service.ts
import { Injectable } from '@angular/core';
import { SupabaseTableService } from './supabase-table.service';
import { SupabaseService } from './supabase.service';
import { LiturgicalText } from '../models/liturgical-text.model';

@Injectable({
  providedIn: 'root',
})
export class LiturgicalTextsService extends SupabaseTableService<LiturgicalText> {
  protected tableName = 'liturgical_texts';

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }

  override async getById(id: string | number): Promise<LiturgicalText | null> {
    // include the textElements associed with the liturgical text
    // order the text elements by sequence 
    const {data, error} = await this.client
      .from(this.tableName)
      .select('*, texts: text_elements(*)')
      .order('sequence', {foreignTable: 'text_elements'})
      .eq('id', id)
      .single();

      if (error) throw error;
      return data;
  }

  override async getAll(): Promise<LiturgicalText[]> {
  
    const { data, error } = await this.client.from(this.tableName).select('*').order('title', { ascending: true });
  
    if (error) throw error;

    return data ?? [];
}
}
