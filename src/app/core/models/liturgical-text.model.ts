import { TextElement } from "./text-element.model";

export interface LiturgicalText {
    id: string;          // uuid
    created_at: string;  // timestamp with time zone
    title: string;       // unique
    audio_time: number | null;
    texts: TextElement[] | null;
  }
  