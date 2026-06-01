import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AiImportBlock, AiImportMeta, AiImportSection } from '../../core/models/ai-import.model';
import { TextElementType } from '../../core/models/text-element.model';
import { LiturgicalAiService } from '../../core/services/liturgical-ai.service';
import { DocxImportService } from '../../core/services/docx-import.service';
import { LiturgicalText } from '../../core/models/liturgical-text.model';
import { DocxImportRulesComponent } from '../../shared/docx-import-rules/docx-import-rules.component';

@Component({
  standalone: true,
  selector: 'app-prayer-import',
  templateUrl: './prayer-import.component.html',
  styleUrls: ['../section-ai-import/section-ai-import.component.css'],
  imports: [CommonModule, FormsModule, RouterLink, DocxImportRulesComponent],
})
export class PrayerImportComponent {
  prayerTitle = '';
  prayerSubtitle = '';

  previewSections: AiImportSection[] | null = null;
  previewMeta: AiImportMeta | null = null;
  textTypes = Object.values(TextElementType);

  saving = false;
  parsingDocx = false;
  errorMessage = '';
  savedPrayerId: string | null = null;

  pickerOpen = false;
  pickerBlock: { sectionIndex: number; blockIndex: number } | null = null;
  pickerFilter = '';
  filteredPickerTexts: LiturgicalText[] = [];
  dbTexts: LiturgicalText[] = [];
  loadingDbTexts = false;
  replacingBlock = false;

  constructor(
    private router: Router,
    private liturgicalAi: LiturgicalAiService,
    private docxImport: DocxImportService,
  ) {}

  async onWordFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    this.parsingDocx = true;
    this.errorMessage = '';
    this.previewSections = null;
    this.previewMeta = null;
    this.savedPrayerId = null;
    this.prayerTitle = '';
    this.prayerSubtitle = '';

    try {
      const { prayerTitle, prayerSubtitle, sections, plainText, warnings } =
        await this.docxImport.parseForPrayer(file);

      for (const sec of sections) {
        this.liturgicalAi.captureImportedPhrases(sec.blocks);
      }
      await this.liturgicalAi.resolveSectionsAgainstExisting(sections);

      this.prayerTitle = prayerTitle;
      this.prayerSubtitle = prayerSubtitle ?? '';
      this.previewSections = sections;
      this.previewMeta = {
        sourceChars: plainText.length,
        chunksProcessed: 0,
        outputTruncated: false,
        source: 'docx',
        docxWarnings: warnings.length ? warnings : undefined,
      };
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Importul Word a eșuat.';
    } finally {
      this.parsingDocx = false;
    }
  }

  totalBlocks(): number {
    return this.previewSections?.reduce((n, s) => n + s.blocks.length, 0) ?? 0;
  }

  async onBlockTitleChange(block: AiImportBlock): Promise<void> {
    await this.liturgicalAi.resolveBlocksAgainstExisting([block]);
  }

  async confirmUseExisting(block: AiImportBlock): Promise<void> {
    this.errorMessage = '';
    try {
      await this.liturgicalAi.applyExistingChoice(block);
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Nu s-a putut încărca textul existent.';
    }
  }

  confirmUseParsed(block: AiImportBlock): void {
    this.liturgicalAi.applyParsedChoice(block);
  }

  async onMatchedExistingIdChange(block: AiImportBlock): Promise<void> {
    if (block.sourceChoice === 'existing') {
      await this.confirmUseExisting(block);
    }
  }

  async saveBlockDraft(block: AiImportBlock): Promise<void> {
    this.errorMessage = '';
    if (!block.title.trim()) {
      this.errorMessage = 'Titlul textului este obligatoriu.';
      return;
    }
    if (block.sourceChoice !== 'existing' && !block.phrases.some((p) => p.text.trim())) {
      this.errorMessage = `Blocul „${block.title}” nu are fraze.`;
      return;
    }

    block.savingBlock = true;
    try {
      await this.liturgicalAi.saveBlockDraft(block);
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Salvarea textului a eșuat.';
    } finally {
      block.savingBlock = false;
    }
  }

  async saveSectionDraft(sec: AiImportSection): Promise<void> {
    if (!sec.title.trim()) {
      this.errorMessage = 'Titlul secțiunii este obligatoriu.';
      return;
    }

    sec.savingSection = true;
    this.errorMessage = '';
    try {
      const { sectionId } = await this.liturgicalAi.saveSectionDraft(
        sec.title.trim(),
        sec.subtitle,
        sec.blocks,
        sec.savedSectionId ?? null,
      );
      sec.savedSectionId = sectionId;
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Salvarea secțiunii a eșuat.';
    } finally {
      sec.savingSection = false;
    }
  }

  async openReplacePicker(sectionIndex: number, blockIndex: number): Promise<void> {
    this.pickerBlock = { sectionIndex, blockIndex };
    this.pickerFilter = '';
    this.pickerOpen = true;
    this.errorMessage = '';

    if (this.dbTexts.length > 0) {
      this.applyPickerFilter();
      return;
    }

    this.loadingDbTexts = true;
    try {
      this.dbTexts = await this.liturgicalAi.listLiturgicalTextTitles();
      this.applyPickerFilter();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Nu s-au putut încărca textele.';
      this.pickerOpen = false;
    } finally {
      this.loadingDbTexts = false;
    }
  }

  closeReplacePicker(): void {
    this.pickerOpen = false;
    this.pickerBlock = null;
    this.pickerFilter = '';
    this.filteredPickerTexts = [];
  }

  applyPickerFilter(): void {
    const q = this.pickerFilter.trim().toLocaleLowerCase('ro-RO');
    if (!q) {
      this.filteredPickerTexts = [...this.dbTexts];
      return;
    }
    this.filteredPickerTexts = this.dbTexts.filter((t) =>
      (t.title ?? '').toLocaleLowerCase('ro-RO').includes(q),
    );
  }

  async selectExistingText(liturgicalTextId: string): Promise<void> {
    if (!this.pickerBlock || !this.previewSections) return;

    const { sectionIndex, blockIndex } = this.pickerBlock;
    this.replacingBlock = true;
    this.errorMessage = '';

    try {
      const previous = this.previewSections[sectionIndex].blocks[blockIndex];
      const block = await this.liturgicalAi.importBlockFromExisting(
        liturgicalTextId,
        previous?.phrases,
      );
      this.previewSections[sectionIndex].blocks[blockIndex] = block;
      this.closeReplacePicker();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Înlocuirea textului a eșuat.';
    } finally {
      this.replacingBlock = false;
    }
  }

  addPhrase(sectionIndex: number, blockIndex: number): void {
    const block = this.previewSections?.[sectionIndex]?.blocks[blockIndex];
    if (!block || block.sourceChoice === 'existing') return;
    block.phrases.push({ text: '', type: TextElementType.PLAIN, highlight: false });
  }

  removePhrase(sectionIndex: number, blockIndex: number, phraseIndex: number): void {
    const block = this.previewSections?.[sectionIndex]?.blocks[blockIndex];
    if (!block || block.sourceChoice === 'existing') return;
    block.phrases.splice(phraseIndex, 1);
  }

  async save(): Promise<void> {
    if (!this.previewSections?.length) return;

    if (!this.prayerTitle.trim()) {
      this.errorMessage = 'Titlul rugăciunii este obligatoriu.';
      return;
    }

    for (const sec of this.previewSections) {
      if (!sec.title.trim()) {
        this.errorMessage = 'Fiecare secțiune trebuie să aibă un titlu.';
        return;
      }
      for (const block of sec.blocks) {
        if (block.sourceChoice === 'parsed') block.linkExisting = false;
        if (!block.title.trim()) {
          this.errorMessage = 'Fiecare bloc trebuie să aibă un titlu.';
          return;
        }
        if (block.sourceChoice !== 'existing' && !block.phrases.some((p) => p.text.trim())) {
          this.errorMessage = `Blocul „${block.title}” nu are fraze.`;
          return;
        }
      }
    }

    this.saving = true;
    this.errorMessage = '';

    try {
      const result = await this.liturgicalAi.createPrayerWithSections(
        this.prayerTitle.trim(),
        this.prayerSubtitle.trim() || null,
        this.previewSections,
        this.savedPrayerId,
      );

      alert(
        `Rugăciunea a fost creată: ${result.sectionCount} secțiuni, ${result.totalBlocks} text(e).`,
      );
      await this.router.navigate(['/prayers', result.prayerId]);
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Salvarea a eșuat.';
    } finally {
      this.saving = false;
    }
  }

  goBack(): void {
    history.back();
  }
}
