import { Injectable } from '@angular/core';
import { LiturgicalText } from '../models/liturgical-text.model';
import { Section } from '../models/section.model';
import { SectionText, SectionTextElement } from '../models/section-text.model';
import { TextElement } from '../models/text-element.model';
import { LiturgicalTextsService } from './liturgical-text.service';
import { SectionTextElementsService } from './section-text-elements.service';
import { SectionTextsService } from './section-texts.service';

export interface LiturgicalTextSectionSyncPhrasePreview {
  text: string;
  isMissing: boolean;
  displayIndex: number;
}

export interface LiturgicalTextSectionSyncOption {
  sectionTextId: number;
  sectionId: string;
  sectionLabel: string;
  missingCount: number;
  phrasePreview: LiturgicalTextSectionSyncPhrasePreview[];
  selected: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LiturgicalTextSectionSyncService {
  constructor(
    private sectionTextsService: SectionTextsService,
    private sectionTextElementsService: SectionTextElementsService,
    private litTextsService: LiturgicalTextsService,
  ) {}

  async findSectionSyncOptions(
    liturgicalTextId: string,
    textElementIds?: string[],
  ): Promise<LiturgicalTextSectionSyncOption[]> {
    const liturgicalText = await this.litTextsService.getById(liturgicalTextId);
    if (!liturgicalText?.texts?.length) return [];

    const relevantTextElements = this.filterRelevantTextElements(liturgicalText.texts, textElementIds);
    if (!relevantTextElements.length) return [];

    const { data, error } = await this.sectionTextsService.client
      .from('section_texts')
      .select('id, prayer_section_id, section_text_elements(text_element_id)')
      .eq('liturgical_text_id', liturgicalTextId);

    if (error) throw error;
    if (!data?.length) return [];

    const sectionsById = await this.loadSectionsById(
      data.map((row) => row.prayer_section_id).filter(Boolean) as string[],
    );

    const options: LiturgicalTextSectionSyncOption[] = [];

    for (const row of data) {
      const linkedIds = new Set(
        (row.section_text_elements ?? []).map(
          (ste: { text_element_id: string }) => ste.text_element_id,
        ),
      );
      const missing = relevantTextElements.filter((te) => !linkedIds.has(te.id));
      if (!missing.length) continue;

      const section = row.prayer_section_id ? sectionsById.get(row.prayer_section_id) : undefined;

      options.push({
        sectionTextId: row.id as number,
        sectionId: row.prayer_section_id ?? '',
        sectionLabel: this.formatSectionLabel(section),
        missingCount: missing.length,
        phrasePreview: this.buildPhrasePreview(liturgicalText.texts, missing, linkedIds),
        selected: true,
      });
    }

    return options.sort((a, b) => a.sectionLabel.localeCompare(b.sectionLabel, 'ro'));
  }

  async applyMissingElements(
    liturgicalTextId: string,
    sectionTextIds: number[],
    textElementIds?: string[],
  ): Promise<number> {
    if (!sectionTextIds.length) return 0;

    const liturgicalText = await this.litTextsService.getById(liturgicalTextId);
    if (!liturgicalText?.texts?.length) return 0;

    let totalInserted = 0;

    for (const sectionTextId of sectionTextIds) {
      totalInserted += await this.introduceMissingForSectionText(
        sectionTextId,
        liturgicalText,
        textElementIds,
      );
    }

    return totalInserted;
  }

  private async loadSectionsById(sectionIds: string[]): Promise<Map<string, Section>> {
    const sectionsById = new Map<string, Section>();
    const uniqueIds = [...new Set(sectionIds)];

    if (!uniqueIds.length) return sectionsById;

    const { data: sections, error } = await this.sectionTextsService.client
      .from('sections')
      .select('id, title, subtitle')
      .in('id', uniqueIds);

    if (error) throw error;

    sections?.forEach((section) => sectionsById.set(section.id, section as Section));
    return sectionsById;
  }

  private filterRelevantTextElements(
    textElements: TextElement[],
    textElementIds?: string[],
  ): TextElement[] {
    if (!textElementIds?.length) {
      return [...textElements];
    }

    return textElements.filter((te) => textElementIds.includes(te.id));
  }

  private formatSectionLabel(section?: Section): string {
    if (!section) return 'Secțiune necunoscută';

    const title = section.title?.trim() || 'Fără titlu';
    const subtitle = section.subtitle?.trim();
    return subtitle ? `${title} — ${subtitle}` : title;
  }

  private buildPhrasePreview(
    textElements: TextElement[],
    missingElements: TextElement[],
    linkedIds: Set<string>,
  ): LiturgicalTextSectionSyncPhrasePreview[] {
    const ordered = [...textElements].sort((a, b) => a.sequence - b.sequence);
    const missingIds = new Set(missingElements.map((te) => te.id));
    const missingIndices = ordered
      .map((te, index) => (missingIds.has(te.id) ? index : -1))
      .filter((index) => index >= 0);

    if (!missingIndices.length) return [];

    const firstMissingIndex = missingIndices[0];
    const lastMissingIndex = missingIndices[missingIndices.length - 1];
    const startIndex = Math.max(0, firstMissingIndex - 1);
    let endIndex = lastMissingIndex;

    for (let index = lastMissingIndex + 1; index < ordered.length; index++) {
      if (linkedIds.has(ordered[index].id)) {
        endIndex = index;
        break;
      }
    }

    return ordered.slice(startIndex, endIndex + 1).map((te, offset) => ({
      text: te.text,
      isMissing: missingIds.has(te.id),
      displayIndex: startIndex + offset + 1,
    }));
  }

  private async introduceMissingForSectionText(
    sectionTextId: number,
    liturgicalText: LiturgicalText,
    textElementIds?: string[],
  ): Promise<number> {
    const { data, error } = await this.sectionTextsService.client
      .from('section_texts')
      .select('id, start_time, section_text_elements(text_element_id, start_time, end_time)')
      .eq('id', sectionTextId)
      .single();

    if (error) throw error;

    const sectionText = data as SectionText;
    const linkedIds = new Set(sectionText.section_text_elements?.map((ste) => ste.text_element_id) ?? []);

    let missingElements = [...(liturgicalText.texts ?? [])]
      .filter((te) => !linkedIds.has(te.id))
      .sort((a, b) => a.sequence - b.sequence);

    if (textElementIds?.length) {
      missingElements = missingElements.filter((te) => textElementIds.includes(te.id));
    }

    if (!missingElements.length) return 0;

    let existingElements = this.sortSectionTextElementsByTextSequence(
      liturgicalText.texts ?? [],
      sectionText.section_text_elements ?? [],
    );

    const rowsToInsert: Array<
      Pick<SectionTextElement, 'section_text_id' | 'text_element_id' | 'start_time' | 'end_time'>
    > = [];

    for (const textElement of missingElements) {
      const { start_time, end_time } = this.defaultTimesForMissingElement(
        liturgicalText.texts ?? [],
        textElement,
        existingElements,
      );

      rowsToInsert.push({
        section_text_id: sectionTextId,
        text_element_id: textElement.id,
        start_time,
        end_time,
      });

      existingElements = this.sortSectionTextElementsByTextSequence(liturgicalText.texts ?? [], [
        ...existingElements,
        {
          section_text_id: sectionTextId,
          text_element_id: textElement.id,
          start_time,
          end_time,
        },
      ]);
    }

    await this.sectionTextElementsService.bulkUpdate(rowsToInsert as SectionTextElement[]);
    return rowsToInsert.length;
  }

  private sortSectionTextElementsByTextSequence(
    textElements: TextElement[],
    sectionTextElements: SectionTextElement[],
  ): SectionTextElement[] {
    const sequenceByTextElementId = new Map(textElements.map((te) => [te.id, te.sequence] as const));

    return [...sectionTextElements].sort(
      (a, b) =>
        (sequenceByTextElementId.get(a.text_element_id) ?? 0) -
        (sequenceByTextElementId.get(b.text_element_id) ?? 0),
    );
  }

  private defaultTimesForMissingElement(
    textElements: TextElement[],
    textElement: TextElement,
    existingElements: SectionTextElement[],
  ): { start_time: number; end_time: number } {
    const orderedTextElements = [...textElements].sort((a, b) => a.sequence - b.sequence);
    const index = orderedTextElements.findIndex((te) => te.id === textElement.id);

    const prevSte =
      index > 0
        ? existingElements.find((ste) => ste.text_element_id === orderedTextElements[index - 1].id)
        : undefined;
    const nextSte =
      index < orderedTextElements.length - 1
        ? existingElements.find((ste) => ste.text_element_id === orderedTextElements[index + 1].id)
        : undefined;

    let start_time = prevSte?.end_time ?? 0;
    let end_time = nextSte?.start_time ?? start_time + 60;
    if (end_time <= start_time) {
      end_time = start_time + 60;
    }

    return { start_time, end_time };
  }
}
