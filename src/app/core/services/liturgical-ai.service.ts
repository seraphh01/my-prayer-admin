import { Injectable } from '@angular/core';
import { AiImportBlock, AiImportSection } from '../models/ai-import.model';
import { LiturgicalText } from '../models/liturgical-text.model';
import { Prayer } from '../models/prayer.model';
import { Section } from '../models/section.model';
import { SectionTextElement } from '../models/section-text.model';
import { TextElement, TextElementType } from '../models/text-element.model';
import { LiturgicalTextsService } from './liturgical-text.service';
import { PrayerSectionService } from './prayer-section.service';
import { PrayersService } from './prayers.service';
import { SectionTextsService } from './section-texts.service';
import { SectionTextElementsService } from './section-text-elements.service';
import { SectionsService } from './sections.service';
import { TextElementsService } from './text-element.service';

export interface SectionAiSaveResult {
  sectionId: string;
  linkedCount: number;
  createdTextsCount: number;
  totalBlocks: number;
}

export interface PrayerAiSaveResult {
  prayerId: string;
  sectionCount: number;
  totalBlocks: number;
}

@Injectable({
  providedIn: 'root',
})
export class LiturgicalAiService {
  private existingByTitleLists: Map<string, LiturgicalText[]> | null = null;

  constructor(
    private litTextsService: LiturgicalTextsService,
    private textElementsService: TextElementsService,
    private sectionTextsService: SectionTextsService,
    private sectionTextElementsService: SectionTextElementsService,
    private sectionsService: SectionsService,
    private prayersService: PrayersService,
    private prayerSectionService: PrayerSectionService,
  ) {}

  clonePhrases(phrases: AiImportBlock['phrases']): AiImportBlock['phrases'] {
    return phrases.map((p) => ({ ...p }));
  }

  /** Păstrează frazele din parsare înainte de orice încărcare din DB. */
  captureImportedPhrases(blocks: AiImportBlock[]): void {
    for (const block of blocks) {
      if (block.importedPhrases?.length) continue;
      if (block.sourceChoice === 'existing') continue;
      if (!block.phrases.some((p) => p.text.trim())) continue;
      block.importedPhrases = this.clonePhrases(block.phrases);
    }
  }

  private restoreImportedPhrases(block: AiImportBlock): void {
    if (block.importedPhrases?.length) {
      block.phrases = this.clonePhrases(block.importedPhrases);
    }
  }

  async resolveBlocksAgainstExisting(blocks: AiImportBlock[]): Promise<void> {
    this.captureImportedPhrases(blocks);
    const byTitle = await this.getExistingByTitleLists();
    for (const block of blocks) {
      const matches = byTitle.get(this.normalizeTitle(block.title)) ?? [];
      const previousChoice = block.sourceChoice;

      if (matches.length === 0) {
        block.titleMatch = false;
        block.matchedExistingTexts = undefined;
        block.existingLiturgicalTextId = null;
        block.linkExisting = false;
        block.sourceChoice = undefined;
        continue;
      }

      block.titleMatch = true;
      block.matchedExistingTexts = matches.map((m) => ({ id: m.id, title: m.title }));

      const idValid =
        block.existingLiturgicalTextId &&
        matches.some((m) => m.id === block.existingLiturgicalTextId);
      if (!idValid) {
        block.existingLiturgicalTextId = matches[0].id;
      }

      if (previousChoice === 'parsed') {
        block.linkExisting = false;
        block.sourceChoice = 'parsed';
        this.restoreImportedPhrases(block);
      } else {
        await this.applyExistingChoice(block);
      }
    }
  }

  async saveLiturgicalText(block: AiImportBlock): Promise<LiturgicalText> {
    if (!block.title.trim()) {
      throw new Error('Titlul textului este obligatoriu.');
    }

    const useExisting =
      block.sourceChoice === 'existing' &&
      block.linkExisting &&
      block.existingLiturgicalTextId;

    if (useExisting) {
      const existing = await this.litTextsService.getById(block.existingLiturgicalTextId!);
      if (!existing) {
        throw new Error(`Textul liturgic „${block.title}” nu a fost găsit.`);
      }
      return existing;
    }

    if (!block.phrases.some((p) => p.text.trim())) {
      throw new Error('Textul trebuie să aibă cel puțin o frază.');
    }

    const litText = await this.createLiturgicalText(block.title.trim());

    const textElements = block.phrases
      .filter((p) => p.text.trim())
      .map(
        (phrase, index) =>
          ({
            text: phrase.text.trim(),
            sequence: index + 1,
            text_id: litText.id,
            type: phrase.type,
            highlight: phrase.highlight,
          }) as TextElement,
      );

    await this.textElementsService.bulkUpdate(textElements);
    return litText;
  }

  async saveToSection(sectionId: string, blocks: AiImportBlock[]): Promise<SectionAiSaveResult> {
    if (!blocks.length) {
      throw new Error('Nu există blocuri de salvat.');
    }

    const { data: existingRows, error: seqError } = await this.sectionTextsService.client
      .from('section_texts')
      .select('sequence')
      .eq('prayer_section_id', sectionId)
      .order('sequence', { ascending: false })
      .limit(1);

    if (seqError) throw seqError;

    let nextSequence =
      existingRows && existingRows.length > 0 ? (existingRows[0].sequence as number) + 1 : 1;

    let linkedCount = 0;
    let createdTextsCount = 0;

    for (const block of blocks) {
      if (block.sectionTextPersisted) continue;

      const wasLinked = Boolean(
        block.sourceChoice === 'existing' && block.linkExisting && block.existingLiturgicalTextId,
      );
      const litText = await this.saveLiturgicalText(block);
      block.savedLiturgicalTextId = litText.id;

      if (wasLinked) {
        linkedCount++;
      } else {
        createdTextsCount++;
      }

      const sectionText = await this.sectionTextsService.create({
        prayer_section_id: sectionId,
        liturgical_text_id: litText.id,
        sequence: nextSequence++,
        repetition: block.repetition ?? 1,
        start_time: 0,
        end_time: 0,
        italic: false,
      });

      const { data: sectionTextElements, error: steError } =
        await this.sectionTextElementsService.client
          .from('section_text_elements')
          .select('section_text_id, text_element_id')
          .eq('section_text_id', sectionText.id);

      if (steError) throw steError;

      await this.zeroSectionTextElementTimes(sectionText.id);
      block.sectionTextPersisted = true;
    }

    return {
      sectionId,
      linkedCount,
      createdTextsCount,
      totalBlocks: blocks.length,
    };
  }

  async saveBlockDraft(block: AiImportBlock): Promise<LiturgicalText> {
    if (!block.title.trim()) {
      throw new Error('Titlul textului este obligatoriu.');
    }

    if (block.savedLiturgicalTextId && block.sourceChoice === 'parsed') {
      return this.updateLiturgicalTextFromBlock(block.savedLiturgicalTextId, block);
    }

    if (block.savedLiturgicalTextId) {
      const existing = await this.litTextsService.getById(block.savedLiturgicalTextId);
      if (existing) return existing;
    }

    const lit = await this.saveLiturgicalText(block);
    block.savedLiturgicalTextId = lit.id;
    return lit;
  }

  async saveSectionDraft(
    sectionTitle: string,
    sectionSubtitle: string | null,
    blocks: AiImportBlock[],
    existingSectionId?: string | null,
  ): Promise<{ sectionId: string }> {
    const title = sectionTitle.trim();
    if (!title) {
      throw new Error('Titlul secțiunii este obligatoriu.');
    }

    let sectionId = existingSectionId ?? null;
    if (!sectionId) {
      const section = await this.sectionsService.create({
        title,
        subtitle: sectionSubtitle?.trim() || null,
        audio_url: '',
        image_url: null,
      } as Partial<Section>);
      sectionId = section.id;
    }

    let nextSequence = await this.nextSectionTextSequence(sectionId);

    for (const block of blocks) {
      if (block.sectionTextPersisted) continue;

      if (!block.savedLiturgicalTextId) {
        const lit = await this.saveLiturgicalText(block);
        block.savedLiturgicalTextId = lit.id;
      }

      const liturgicalTextId = block.savedLiturgicalTextId!;
      const sectionText = await this.sectionTextsService.create({
        prayer_section_id: sectionId,
        liturgical_text_id: liturgicalTextId,
        sequence: nextSequence++,
        repetition: block.repetition ?? 1,
        start_time: 0,
        end_time: 0,
        italic: false,
      });

      await this.zeroSectionTextElementTimes(sectionText.id);
      block.sectionTextPersisted = true;
    }

    return { sectionId };
  }

  async createSectionWithBlocks(
    sectionTitle: string,
    sectionSubtitle: string | null,
    blocks: AiImportBlock[],
    existingSectionId?: string | null,
  ): Promise<SectionAiSaveResult> {
    const title = sectionTitle.trim();
    if (!title) {
      throw new Error('Titlul secțiunii este obligatoriu.');
    }

    if (existingSectionId) {
      await this.saveSectionDraft(title, sectionSubtitle, blocks, existingSectionId);
      return this.summarizeSectionSave(existingSectionId, blocks);
    }

    const section = await this.sectionsService.create({
      title,
      subtitle: sectionSubtitle?.trim() || null,
      audio_url: '',
      image_url: null,
    } as Partial<Section>);

    const pending = blocks.filter((b) => !b.sectionTextPersisted);
    const result =
      pending.length > 0
        ? await this.saveToSection(section.id, pending)
        : { sectionId: section.id, linkedCount: 0, createdTextsCount: 0, totalBlocks: 0 };

    for (const block of blocks) {
      block.sectionTextPersisted = true;
    }
    return { ...result, sectionId: section.id, totalBlocks: blocks.length };
  }

  private summarizeSectionSave(sectionId: string, blocks: AiImportBlock[]): SectionAiSaveResult {
    return {
      sectionId,
      linkedCount: blocks.filter((b) => b.sourceChoice === 'existing').length,
      createdTextsCount: blocks.filter((b) => b.sourceChoice !== 'existing').length,
      totalBlocks: blocks.length,
    };
  }

  async createPrayerWithSections(
    prayerTitle: string,
    prayerSubtitle: string | null,
    sections: AiImportSection[],
    existingPrayerId?: string | null,
  ): Promise<PrayerAiSaveResult> {
    const title = prayerTitle.trim();
    if (!title) {
      throw new Error('Titlul rugăciunii este obligatoriu.');
    }
    if (!sections.length) {
      throw new Error('Nu există secțiuni de importat.');
    }

    let prayer: Prayer;
    if (existingPrayerId) {
      const existing = await this.prayersService.getById(existingPrayerId);
      if (!existing) throw new Error('Rugăciunea nu a fost găsită.');
      prayer = existing;
    } else {
      prayer = await this.prayersService.create({
        title,
        subtitle: prayerSubtitle?.trim() || null,
        sequence: 1,
      } as Partial<Prayer>);
    }

    let nextPrayerSectionSeq = await this.nextPrayerSectionSequence(prayer.id);
    let totalBlocks = 0;

    for (const sec of sections) {
      const secTitle = sec.title.trim() || 'Secțiune';
      const draft = await this.saveSectionDraft(
        secTitle,
        sec.subtitle,
        sec.blocks,
        sec.savedSectionId ?? null,
      );
      sec.savedSectionId = draft.sectionId;

      const alreadyLinked = await this.isSectionLinkedToPrayer(prayer.id, draft.sectionId);
      if (!alreadyLinked) {
        await this.prayerSectionService.create({
          prayer_id: prayer.id,
          section_id: draft.sectionId,
          sequence: nextPrayerSectionSeq++,
          parent_id: null,
        });
      }

      totalBlocks += sec.blocks.length;
    }

    return { prayerId: prayer.id, sectionCount: sections.length, totalBlocks };
  }

  async resolveSectionsAgainstExisting(sections: AiImportSection[]): Promise<void> {
    for (const sec of sections) {
      await this.resolveBlocksAgainstExisting(sec.blocks);
    }
  }

  private async getExistingByTitleLists(): Promise<Map<string, LiturgicalText[]>> {
    if (this.existingByTitleLists) {
      return this.existingByTitleLists;
    }

    const { data, error } = await this.litTextsService.client
      .from('liturgical_texts')
      .select('id, title')
      .order('title', { ascending: true });

    if (error) throw error;

    const map = new Map<string, LiturgicalText[]>();
    for (const row of data ?? []) {
      if (!row.title) continue;
      const key = this.normalizeTitle(row.title);
      const list = map.get(key) ?? [];
      list.push(row as LiturgicalText);
      map.set(key, list);
    }
    this.existingByTitleLists = map;
    return map;
  }

  clearExistingTextsCache(): void {
    this.existingByTitleLists = null;
  }

  async applyExistingChoice(block: AiImportBlock): Promise<void> {
    this.captureImportedPhrases([block]);

    const id = block.existingLiturgicalTextId ?? block.matchedExistingTexts?.[0]?.id;
    if (!id) return;

    const litText = await this.litTextsService.getById(id);
    if (!litText) {
      throw new Error('Textul liturgic nu a fost găsit.');
    }

    block.title = litText.title;
    block.phrases = (litText.texts ?? [])
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((te) => ({
        text: te.text ?? '',
        type: this.normalizeType(te.type),
        highlight: te.highlight ?? false,
      }));
    block.existingLiturgicalTextId = id;
    block.linkExisting = true;
    block.sourceChoice = 'existing';
  }

  applyParsedChoice(block: AiImportBlock): void {
    block.linkExisting = false;
    block.sourceChoice = 'parsed';
    this.restoreImportedPhrases(block);
  }

  async listLiturgicalTextTitles(): Promise<LiturgicalText[]> {
    return this.litTextsService.getAll();
  }

  async importBlockFromExisting(
    liturgicalTextId: string,
    importedPhrases?: AiImportBlock['phrases'],
  ): Promise<AiImportBlock> {
    const litText = await this.litTextsService.getById(liturgicalTextId);
    if (!litText) {
      throw new Error('Textul liturgic nu a fost găsit.');
    }

    const phrases = (litText.texts ?? [])
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((te) => ({
        text: te.text ?? '',
        type: this.normalizeType(te.type),
        highlight: te.highlight ?? false,
      }));

    const block: AiImportBlock = {
      title: litText.title,
      repetition: 1,
      phrases,
      existingLiturgicalTextId: litText.id,
      linkExisting: true,
      sourceChoice: 'existing',
      importedPhrases: importedPhrases?.length ? this.clonePhrases(importedPhrases) : undefined,
    };
    await this.resolveBlocksAgainstExisting([block]);
    return block;
  }

  private normalizeTitle(title: string): string {
    return title.trim().toLocaleLowerCase('ro-RO');
  }

  private async createLiturgicalText(title: string) {
    try {
      const created = await this.litTextsService.create({ title });
      this.clearExistingTextsCache();
      return created;
    } catch {
      const suffix = new Date().toISOString().slice(11, 19).replace(/:/g, '');
      const created = await this.litTextsService.create({ title: `${title} (${suffix})` });
      this.clearExistingTextsCache();
      return created;
    }
  }

  private normalizeType(type: string): string {
    const values = Object.values(TextElementType) as string[];
    return values.includes(type) ? type : TextElementType.PLAIN;
  }

  private async updateLiturgicalTextFromBlock(
    textId: string,
    block: AiImportBlock,
  ): Promise<LiturgicalText> {
    if (!block.phrases.some((p) => p.text.trim())) {
      throw new Error('Textul trebuie să aibă cel puțin o frază.');
    }

    const textElements = block.phrases
      .filter((p) => p.text.trim())
      .map(
        (phrase, index) =>
          ({
            text: phrase.text.trim(),
            sequence: index + 1,
            text_id: textId,
            type: phrase.type,
            highlight: phrase.highlight,
          }) as TextElement,
      );

    await this.textElementsService.bulkUpdate(textElements);
    const lit = await this.litTextsService.getById(textId);
    if (!lit) throw new Error('Textul liturgic nu a fost găsit.');
    return lit;
  }

  private async nextSectionTextSequence(sectionId: string): Promise<number> {
    const { data: existingRows, error } = await this.sectionTextsService.client
      .from('section_texts')
      .select('sequence')
      .eq('prayer_section_id', sectionId)
      .order('sequence', { ascending: false })
      .limit(1);

    if (error) throw error;
    return existingRows && existingRows.length > 0 ? (existingRows[0].sequence as number) + 1 : 1;
  }

  private async nextPrayerSectionSequence(prayerId: string): Promise<number> {
    const { data, error } = await this.prayerSectionService.client
      .from('prayers_sections')
      .select('sequence')
      .eq('prayer_id', prayerId)
      .order('sequence', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? (data[0].sequence as number) + 1 : 1;
  }

  private async isSectionLinkedToPrayer(prayerId: string, sectionId: string): Promise<boolean> {
    const { data, error } = await this.prayerSectionService.client
      .from('prayers_sections')
      .select('id')
      .eq('prayer_id', prayerId)
      .eq('section_id', sectionId)
      .limit(1);

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  private async zeroSectionTextElementTimes(sectionTextId: string | number): Promise<void> {
    const { data: sectionTextElements, error: steError } =
      await this.sectionTextElementsService.client
        .from('section_text_elements')
        .select('section_text_id, text_element_id')
        .eq('section_text_id', sectionTextId);

    if (steError) throw steError;

    if (sectionTextElements?.length) {
      await this.sectionTextElementsService.bulkUpdate(
        sectionTextElements.map(
          (ste) =>
            ({
              section_text_id: ste.section_text_id,
              text_element_id: ste.text_element_id,
              start_time: 0,
              end_time: 0,
            }) as SectionTextElement,
        ),
      );
    }
  }
}
