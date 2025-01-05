import { SectionText } from "./section-text.model";

export interface Section {
    id: string;             // uuid
    created_at: string;     // timestamp with time zone
    title: string | null;
    audio_url: string;
    subtitle: string | null;
    duration: number;
    image_url: string | null;
    texts: SectionText[] | null;
  }
  