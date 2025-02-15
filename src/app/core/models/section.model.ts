import { SectionText } from "./section-text.model";

export interface Section {
    id: string;             // uuid
    created_at: string;     // timestamp with time zone
    title: string | null;
    audio_url: string;
    subtitle: string | null;
    image_url: string | null;
    show_title: boolean;
    show_subtitle: boolean;
    texts: SectionText[] | null;
  }
  