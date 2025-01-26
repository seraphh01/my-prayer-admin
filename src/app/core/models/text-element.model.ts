export interface TextElement {
    id: string;             // uuid
    created_at: string;     // timestamp with time zone
    text: string;
    sequence: number;
    text_id: string | null; // references liturgical_texts (id)
    highlight: boolean;
    type: string;
  }

export enum TextElementType {
    PLAIN = 'PlainText',
    QUOTE = 'Quote',
}
