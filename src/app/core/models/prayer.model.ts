export interface Prayer {
    id: string;             // uuid
    created_at: string;     // timestamp with time zone
    title: string;
    prayer_type_id: number | null;
    subtitle: string | null;
    sequence: number | null;
  }
  