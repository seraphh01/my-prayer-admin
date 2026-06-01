import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AiImportBlock, AiImportMeta } from '../../core/models/ai-import.model';
import { TextElementType } from '../../core/models/text-element.model';
import { LiturgicalAiService } from '../../core/services/liturgical-ai.service';
import { DocxImportService } from '../../core/services/docx-import.service';
import { LiturgicalText } from '../../core/models/liturgical-text.model';
import { DocxImportRulesComponent } from '../../shared/docx-import-rules/docx-import-rules.component';

@Component({
  standalone: true,
  selector: 'app-section-ai-import',
  templateUrl: './section-ai-import.component.html',
  styleUrls: ['./section-ai-import.component.css'],
  imports: [CommonModule, FormsModule, RouterLink, DocxImportRulesComponent],
})
export class SectionAiImportComponent {
  sectionTitle = '';
  sectionSubtitle = '';

  previewBlocks: AiImportBlock[] | null = null;
  previewMeta: AiImportMeta | null = null;
  textTypes = Object.values(TextElementType);

  saving = false;
  parsingDocx = false;
  errorMessage = '';
  savedSectionId: string | null = null;

  pickerOpen = false;
  pickerBlockIndex: number | null = null;
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
    this.previewBlocks = null;
    this.previewMeta = null;
    this.savedSectionId = null;
    this.sectionTitle = '';
    this.sectionSubtitle = '';

    try {
      const { blocks, sectionTitle, sectionSubtitle, plainText, warnings } =
        await this.docxImport.parseForSection(file);
      this.liturgicalAi.captureImportedPhrases(blocks);
      await this.liturgicalAi.resolveBlocksAgainstExisting(blocks);

      this.sectionTitle = sectionTitle;
      this.sectionSubtitle = sectionSubtitle ?? '';
      this.previewBlocks = blocks;
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

  addBlock(afterIndex?: number): void {
    if (!this.previewBlocks) {
      this.previewBlocks = [];
    }
    const newBlock: AiImportBlock = {
      title: 'Text nou',
      repetition: 1,
      phrases: [{ text: '', type: TextElementType.PLAIN, highlight: false }],
      linkExisting: false,
    };
    if (afterIndex === undefined || afterIndex < 0) {
      this.previewBlocks.push(newBlock);
    } else {
      this.previewBlocks.splice(afterIndex + 1, 0, newBlock);
    }
  }

  removeBlock(index: number): void {
    this.previewBlocks?.splice(index, 1);
  }

  moveBlockUp(index: number): void {
    if (!this.previewBlocks || index <= 0) return;
    const blocks = this.previewBlocks;
    [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]];
  }

  moveBlockDown(index: number): void {
    if (!this.previewBlocks || index >= this.previewBlocks.length - 1) return;
    const blocks = this.previewBlocks;
    [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
  }

  async openReplacePicker(index: number): Promise<void> {
    this.pickerBlockIndex = index;
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
    this.pickerBlockIndex = null;
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
    if (this.pickerBlockIndex === null || !this.previewBlocks) return;

    this.replacingBlock = true;
    this.errorMessage = '';

    try {
      const previous = this.previewBlocks[this.pickerBlockIndex];
      const block = await this.liturgicalAi.importBlockFromExisting(
        liturgicalTextId,
        previous?.phrases,
      );
      this.previewBlocks[this.pickerBlockIndex] = block;
      this.closeReplacePicker();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Înlocuirea textului a eșuat.';
    } finally {
      this.replacingBlock = false;
    }
  }

  addPhrase(blockIndex: number): void {
    const block = this.previewBlocks?.[blockIndex];
    if (!block || block.sourceChoice === 'existing') return;
    block.phrases.push({ text: '', type: TextElementType.PLAIN, highlight: false });
  }

  removePhrase(blockIndex: number, phraseIndex: number): void {
    const block = this.previewBlocks?.[blockIndex];
    if (!block || block.sourceChoice === 'existing') return;
    block.phrases.splice(phraseIndex, 1);
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

  async saveSectionDraft(): Promise<void> {
    if (!this.previewBlocks?.length) return;
    if (!this.sectionTitle.trim()) {
      this.errorMessage = 'Titlul secțiunii este obligatoriu.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    try {
      const { sectionId } = await this.liturgicalAi.saveSectionDraft(
        this.sectionTitle.trim(),
        this.sectionSubtitle.trim() || null,
        this.previewBlocks,
        this.savedSectionId,
      );
      this.savedSectionId = sectionId;
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Salvarea secțiunii a eșuat.';
    } finally {
      this.saving = false;
    }
  }

  async save(): Promise<void> {
    if (!this.previewBlocks?.length) return;

    if (!this.sectionTitle.trim()) {
      this.errorMessage = 'Titlul secțiunii este obligatoriu.';
      return;
    }

    for (const block of this.previewBlocks) {
      if (block.sourceChoice === 'parsed') {
        block.linkExisting = false;
      }
      if (!block.title.trim()) {
        this.errorMessage = 'Fiecare bloc trebuie să aibă un titlu.';
        return;
      }
      if (block.sourceChoice !== 'existing' && !block.phrases.some((p) => p.text.trim())) {
        this.errorMessage = `Blocul „${block.title}” nu are fraze.`;
        return;
      }
    }

    this.saving = true;
    this.errorMessage = '';

    try {
      const result = await this.liturgicalAi.createSectionWithBlocks(
        this.sectionTitle.trim(),
        this.sectionSubtitle.trim() || null,
        this.previewBlocks,
        this.savedSectionId,
      );

      const parts = [
        `Secțiunea a fost creată.`,
        `${result.totalBlocks} text(e) în secțiune`,
        result.linkedCount > 0 ? `${result.linkedCount} legate la texte existente` : null,
        result.createdTextsCount > 0 ? `${result.createdTextsCount} texte noi create` : null,
        
      ].filter(Boolean);

      alert(parts.join('. ') + '.');
      await this.router.navigate(['/sections', result.sectionId]);
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
