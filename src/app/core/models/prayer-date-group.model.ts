import { DateGroup } from "./date-group.model";

export interface PrayerDateGroup {
    id: string;      // uuid
    prayer_id: string;
    date_group_id: number;
    sequence: number;
    date_group: DateGroup | null;
  }
  