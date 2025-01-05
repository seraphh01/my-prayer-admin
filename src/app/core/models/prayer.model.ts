import { DateGroup } from "./date-group.model";
import { PrayerDateGroup } from "./prayer-date-group.model";
import { PrayerSection } from "./prayer-section.model";

export interface Prayer {
    id: string;             // uuid
    created_at: string;     // timestamp with time zone
    title: string;
    prayer_type_id: number | null;
    subtitle: string | null;
    sequence: number | null;
    sections: PrayerSection[] | null;
    date_groups: PrayerDateGroup[] | null;
  }
  