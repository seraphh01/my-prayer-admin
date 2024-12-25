export interface PrayerSection {
    id: string;             // uuid
    created_at: string;     // timestamp with time zone
    prayer_id: string;      // references prayers (id)
    sequence: number;
    section_id: string | null;
    parent_id: string | null;
  }
  