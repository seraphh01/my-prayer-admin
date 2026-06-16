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
  private static readonly BATCH_SIZE = 100;

  constructor(protected override supabase: SupabaseService) {
    super(supabase);
  }

  async updateSequence(id: string, newSequence: number) {
    return this.update(id, { sequence: newSequence });
  }

  async deleteMany(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += TextElementsService.BATCH_SIZE) {
      const batch = ids.slice(i, i + TextElementsService.BATCH_SIZE);
      const { error } = await this.client.from(this.tableName).delete().in('id', batch);
      if (error) throw error;
    }
  }

  async createMany(items: Partial<TextElement>[]): Promise<TextElement[]> {
    const results: TextElement[] = [];

    for (let i = 0; i < items.length; i += TextElementsService.BATCH_SIZE) {
      const batch = items.slice(i, i + TextElementsService.BATCH_SIZE);
      const { data, error } = await this.client.from(this.tableName).insert(batch).select();
      if (error) throw error;
      if (data) results.push(...data);
    }

    return results;
  }

  async updateMany(items: Partial<TextElement>[]): Promise<TextElement[]> {
    const results: TextElement[] = [];

    for (let i = 0; i < items.length; i += TextElementsService.BATCH_SIZE) {
      const batch = items.slice(i, i + TextElementsService.BATCH_SIZE);
      const { data, error } = await this.client
        .from(this.tableName)
        .upsert(batch, { onConflict: 'id' })
        .select();
      if (error) throw error;
      if (data) results.push(...data);
    }

    return results;
  }
}
