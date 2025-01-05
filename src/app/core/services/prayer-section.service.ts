import { Inject, Injectable } from "@angular/core";
import { PrayerSection } from "../models/prayer-section.model";
import { SupabaseTableService } from "./supabase-table.service";
import { SupabaseService } from "./supabase.service";

@Injectable({
    providedIn: 'root',})
export class PrayerSectionService extends SupabaseTableService<PrayerSection> {
    protected tableName = 'prayers_sections';
      constructor(protected override supabase: SupabaseService) {
        super(supabase);
      }


  override async create(item: Partial<PrayerSection>): Promise<PrayerSection> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert([item])
      .select('*, section: sections(*)')
      .single();

    if (error) throw error;
    return data;
  }
}