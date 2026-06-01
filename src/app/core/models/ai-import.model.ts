export interface AiImportPhrase {
  text: string;
  type: string;
  highlight: boolean;
}

export interface AiImportExistingMatch {
  id: string;
  title: string;
}

export interface AiImportBlock {
  title: string;
  phrases: AiImportPhrase[];
  repetition: number;
  existingLiturgicalTextId?: string | null;
  linkExisting?: boolean;
  titleMatch?: boolean;
  matchedExistingTexts?: AiImportExistingMatch[];
  importedPhrases?: AiImportPhrase[];
  parsedPhrasesBackup?: AiImportPhrase[];
  sourceChoice?: 'parsed' | 'existing';
  /** Text salvat (salvare intermediară) */
  savedLiturgicalTextId?: string | null;
  /** Legat la section_text în secțiunea salvată intermediar */
  sectionTextPersisted?: boolean;
  savingBlock?: boolean;
}

export interface AiImportSection {
  title: string;
  subtitle: string | null;
  blocks: AiImportBlock[];
  /** Secțiune salvată (salvare intermediară) */
  savedSectionId?: string | null;
  savingSection?: boolean;
}

export interface AiImportMeta {
  sourceChars: number;
  chunksProcessed: number;
  outputTruncated: boolean;
  source?: 'docx';
  docxWarnings?: string[];
}

export interface DocxSectionImportResult {
  sectionTitle: string;
  sectionSubtitle: string | null;
  blocks: AiImportBlock[];
  plainText: string;
  warnings: string[];
}

export interface DocxPrayerImportResult {
  prayerTitle: string;
  prayerSubtitle: string | null;
  sections: AiImportSection[];
  plainText: string;
  warnings: string[];
}
