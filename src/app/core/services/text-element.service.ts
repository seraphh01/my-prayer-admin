// src/app/core/services/text-elements.service.ts
import { Injectable } from '@angular/core';
import { SupabaseTableService } from './supabase-table.service';
import { SupabaseService } from './supabase.service';
import { TextElement } from '../models/text-element.model';

@Injectable({
  providedIn: 'root',
})
export class TextElementsService extends SupabaseTableService<TextElement> {
  protected tableName = 'text_elements';

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }

  // Example custom method for reordering:
  async updateSequence(id: string, newSequence: number) {
    return this.update(id, { sequence: newSequence });
  }


  // etc.
}
