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

    /**
   * Perform a bulk delete.
   * section text elements have a composite key formed by section_text_id and text_element_id
   */
    async deleteMany(sectionTextElements: SectionTextElement[]): Promise<void> {
      if (sectionTextElements.length === 0) return; // Avoid unnecessary calls
    
      const { error } = await this.client.rpc("delete_section_text_elements", {
        deleted_section_text_elements: sectionTextElements.map((ste) => ({ section_text_id: ste.section_text_id, text_element_id: ste.text_element_id })),
      });
    
      if (error) throw error;
    }
    
  // Example: we might add a method to reorder sequences in a transaction
  // or just update them individually when we swap.
}
