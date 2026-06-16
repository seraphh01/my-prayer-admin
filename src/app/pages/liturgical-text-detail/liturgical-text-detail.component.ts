// src/app/pages/liturgical-text-detail/liturgical-text-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LiturgicalText } from '../../core/models/liturgical-text.model';
import { TextElement, TextElementType } from '../../core/models/text-element.model';
import { LiturgicalTextsService } from '../../core/services/liturgical-text.service';
import { TextElementsService } from '../../core/services/text-element.service';
import {
  LiturgicalTextSectionSyncOption,
  LiturgicalTextSectionSyncService,
} from '../../core/services/liturgical-text-section-sync.service';

interface TextElementDraft {
  localKey: string;
  id?: string;
  text: string;
  highlight: boolean;
  type: string;
  quote_source: string | null;
  isNew: boolean;
  markedForDeletion: boolean;
}

@Component({
  standalone: true,
  selector: 'app-liturgical-text-detail',
  templateUrl: './liturgical-text-detail.component.html',
  styleUrls: ['./liturgical-text-detail.component.css'],
  imports: [CommonModule, FormsModule],
})
export class LiturgicalTextDetailComponent implements OnInit {
  textId!: string;
  text: LiturgicalText | null = null;

  editedTitle = '';

  textTypes = Object.values(TextElementType);
  textTitle = '';

  textsEditMode = false;
  textsEditSaving = false;
  editDraft: TextElementDraft[] = [];
  private originalDraftById = new Map<string, TextElement>();

  sectionStartTime: number | null = 0;

  sectionSyncModalOpen = false;
  sectionSyncApplying = false;
  sectionSyncLoading = false;
  sectionSyncOnlyNewPhrases = false;
  sectionSyncAvailable = false;
  sectionSyncOptions: LiturgicalTextSectionSyncOption[] = [];
  private pendingSyncTextElementIds: string[] = [];
  private draftLocalKeyCounter = 0;

  constructor(
    private route: ActivatedRoute,
    private litTextService: LiturgicalTextsService,
    private textElementsService: TextElementsService,
    private sectionSyncService: LiturgicalTextSectionSyncService,
  ) {}

  async ngOnInit(): Promise<void> {
    this.textId = this.route.snapshot.paramMap.get('id') || '';
    this.sectionStartTime = parseInt(this.route.snapshot.paramMap.get('sectionStartTime') || '0');
    await this.loadLiturgicalText();
  }

  async loadLiturgicalText() {
    this.text = await this.litTextService.getById(this.textId);
    this.textTitle = this.text?.title ?? '';
    await this.refreshSectionSyncAvailability();
  }

  private async refreshSectionSyncAvailability() {
    if (!this.textId) {
      this.sectionSyncAvailable = false;
      return;
    }

    try {
      const options = await this.sectionSyncService.findSectionSyncOptions(this.textId);
      this.sectionSyncAvailable = options.length > 0;
    } catch (error) {
      console.error('Error checking section sync availability:', error);
      this.sectionSyncAvailable = false;
    }
  }

  async saveTitle() {
    if (!this.text) return;
    try {
      const updated = await this.litTextService.update(this.text.id, {
        title: this.text.title ?? null,
      });
      if (updated) {
        alert('Textul a fost salvat!');
        this.textTitle = this.text.title ?? '';
      }
    } catch (error) {
      console.error('Error updating title:', error);
    }
  }

  startTextsEdit() {
    const sorted = [...(this.text?.texts ?? [])].sort((a, b) => a.sequence - b.sequence);
    this.originalDraftById = new Map(sorted.map((te) => [te.id, te]));
    this.editDraft = sorted.map((te) => this.toDraft(te));
    if (!this.editDraft.length) {
      this.editDraft.push(this.createEmptyDraft());
    }
    this.textsEditMode = true;
  }

  cancelTextsEdit() {
    this.textsEditMode = false;
    this.editDraft = [];
    this.originalDraftById.clear();
  }

  async saveTextsEdit() {
    if (!this.textId || this.textsEditSaving) return;

    const activeItems = this.editDraft
      .filter((item) => !item.markedForDeletion)
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text.length > 0);

    if (!activeItems.length) {
      if (!confirm('Nu ai niciun text. Vrei să ștergi toate frazele?')) return;
    }

    this.textsEditSaving = true;
    try {
      const originals = [...(this.text?.texts ?? [])].sort((a, b) => a.sequence - b.sequence);
      const originalById = new Map(originals.map((te) => [te.id, te]));

      const idsToDelete = this.editDraft
        .filter((item) => item.markedForDeletion && item.id && !item.isNew)
        .map((item) => item.id!);
      const toCreate: Partial<TextElement>[] = [];
      const toUpdate: Partial<TextElement>[] = [];

      for (let i = 0; i < activeItems.length; i++) {
        const item = activeItems[i];
        const sequence = i + 1;
        const payload: Partial<TextElement> = {
          text: item.text,
          sequence,
          text_id: this.textId,
          type: item.type,
          highlight: item.highlight,
          quote_source: item.type === TextElementType.QUOTE ? item.quote_source : null,
        };

        if (item.isNew) {
          toCreate.push(payload);
          continue;
        }

        const original = originalById.get(item.id!);
        if (!original || this.draftItemChanged(item, original, sequence)) {
          toUpdate.push({ id: item.id, ...payload });
        }
      }

      if (idsToDelete.length) {
        await this.textElementsService.deleteMany(idsToDelete);
      }

      const created = toCreate.length ? await this.textElementsService.createMany(toCreate) : [];
      if (toUpdate.length) {
        await this.textElementsService.updateMany(toUpdate);
      }

      const newIds = created.map((row) => row.id);
      const hasChanges = idsToDelete.length > 0 || toCreate.length > 0 || toUpdate.length > 0;

      this.textsEditMode = false;
      this.editDraft = [];
      this.originalDraftById.clear();

      if (hasChanges) {
        await this.loadLiturgicalText();
        await this.openSectionSyncModalAfterSave(newIds);
      }
    } catch (error: any) {
      alert('Nu am putut salva textele: ' + (error?.message ?? error));
    } finally {
      this.textsEditSaving = false;
    }
  }

  private draftItemChanged(item: TextElementDraft, original: TextElement, sequence: number): boolean {
    return (
      this.draftItemContentChanged(item, original) ||
      sequence !== original.sequence
    );
  }

  private draftItemContentChanged(item: TextElementDraft, original: TextElement): boolean {
    const quoteSource = item.type === TextElementType.QUOTE ? item.quote_source : null;
    const originalQuote = original.type === TextElementType.QUOTE ? original.quote_source : null;

    return (
      item.text !== original.text ||
      item.type !== original.type ||
      item.highlight !== original.highlight ||
      quoteSource !== originalQuote
    );
  }

  private draftItemOrderChanged(index: number): boolean {
    const item = this.editDraft[index];
    if (!item.id) return false;

    const originalSorted = [...this.originalDraftById.values()].sort((a, b) => a.sequence - b.sequence);
    const stillActiveOriginalIds = originalSorted
      .map((te) => te.id)
      .filter((id) => {
        const draft = this.editDraft.find((d) => d.id === id);
        return draft && !draft.markedForDeletion;
      });

    const currentActiveExistingIds = this.editDraft
      .filter((d) => !d.markedForDeletion && d.id && !d.isNew)
      .map((d) => d.id!);

    const currentPos = currentActiveExistingIds.indexOf(item.id);
    const originalPos = stillActiveOriginalIds.indexOf(item.id);

    return currentPos !== originalPos;
  }

  insertDraftItemAt(index: number) {
    this.editDraft.splice(index, 0, this.createEmptyDraft());
  }

  insertDraftItemAfter(index: number) {
    this.editDraft.splice(index + 1, 0, this.createEmptyDraft());
  }

  addDraftItemAtEnd() {
    this.editDraft.push(this.createEmptyDraft());
  }

  removeDraftItem(index: number) {
    const item = this.editDraft[index];
    if (item.isNew && !item.text.trim()) {
      this.editDraft.splice(index, 1);
      return;
    }
    item.markedForDeletion = true;
  }

  restoreDraftItem(index: number) {
    this.editDraft[index].markedForDeletion = false;
  }

  moveDraftUp(index: number) {
    if (index === 0) return;
    const item = this.editDraft[index];
    this.editDraft[index] = this.editDraft[index - 1];
    this.editDraft[index - 1] = item;
  }

  moveDraftDown(index: number) {
    if (index >= this.editDraft.length - 1) return;
    const item = this.editDraft[index];
    this.editDraft[index] = this.editDraft[index + 1];
    this.editDraft[index + 1] = item;
  }

  getDraftDisplayIndex(index: number): number {
    let displayIndex = 0;
    for (let i = 0; i <= index; i++) {
      if (!this.editDraft[i].markedForDeletion) {
        displayIndex++;
      }
    }
    return displayIndex;
  }

  isDraftItemNew(item: TextElementDraft): boolean {
    return item.isNew && !item.markedForDeletion;
  }

  isDraftItemChanged(index: number): boolean {
    const item = this.editDraft[index];
    if (item.markedForDeletion || item.isNew || !item.id) return false;

    const original = this.originalDraftById.get(item.id);
    if (!original) return false;

    return (
      this.draftItemContentChanged({ ...item, text: item.text.trim() }, original) ||
      this.draftItemOrderChanged(index)
    );
  }

  isFirstActiveDraftIndex(index: number): boolean {
    return index === this.editDraft.findIndex((item) => !item.markedForDeletion);
  }

  isLastActiveDraftIndex(index: number): boolean {
    if (this.editDraft[index]?.markedForDeletion) return false;

    for (let i = this.editDraft.length - 1; i >= 0; i--) {
      if (!this.editDraft[i].markedForDeletion) {
        return i === index;
      }
    }

    return false;
  }

  trackDraftByLocalKey(_index: number, item: TextElementDraft): string {
    return item.localKey;
  }

  private toDraft(te: TextElement): TextElementDraft {
    return {
      localKey: te.id,
      id: te.id,
      text: te.text,
      highlight: te.highlight,
      type: te.type,
      quote_source: te.quote_source,
      isNew: false,
      markedForDeletion: false,
    };
  }

  private createEmptyDraft(): TextElementDraft {
    return {
      localKey: `new-${++this.draftLocalKeyCounter}`,
      text: '',
      highlight: false,
      type: TextElementType.PLAIN,
      quote_source: null,
      isNew: true,
      markedForDeletion: false,
    };
  }

  private async openSectionSyncModalAfterSave(newIds: string[]) {
    await this.loadSectionSyncModal(newIds.length ? newIds : undefined, true);
  }

  async openSectionSyncModal() {
    await this.loadSectionSyncModal(undefined, false);
  }

  private async loadSectionSyncModal(textElementIds: string[] | undefined, onlyIfNeeded: boolean) {
    this.sectionSyncOnlyNewPhrases = Boolean(textElementIds?.length);
    this.pendingSyncTextElementIds = textElementIds ?? [];
    this.sectionSyncLoading = true;

    try {
      this.sectionSyncOptions = await this.sectionSyncService.findSectionSyncOptions(
        this.textId,
        this.pendingSyncTextElementIds.length ? this.pendingSyncTextElementIds : undefined,
      );

      if (!this.sectionSyncOptions.length) {
        if (!onlyIfNeeded) {
          alert('Toate secțiunile care folosesc acest text sunt deja sincronizate.');
        }
        this.sectionSyncAvailable = false;
        return;
      }

      this.sectionSyncAvailable = true;
      this.sectionSyncModalOpen = true;
    } catch (error) {
      console.error('Error loading section sync options:', error);
      alert('Nu am putut încărca secțiunile pentru sincronizare.');
    } finally {
      this.sectionSyncLoading = false;
    }
  }

  selectAllSectionSyncOptions(selected: boolean) {
    this.sectionSyncOptions.forEach((option) => {
      option.selected = selected;
    });
  }

  get selectedSectionSyncCount(): number {
    return this.sectionSyncOptions.filter((option) => option.selected).length;
  }

  closeSectionSyncModal() {
    this.sectionSyncModalOpen = false;
    this.sectionSyncOptions = [];
    this.pendingSyncTextElementIds = [];
  }

  async applySectionSync() {
    const selectedIds = this.sectionSyncOptions
      .filter((option) => option.selected)
      .map((option) => option.sectionTextId);

    if (!selectedIds.length) {
      this.closeSectionSyncModal();
      return;
    }

    this.sectionSyncApplying = true;
    try {
      const insertedCount = await this.sectionSyncService.applyMissingElements(
        this.textId,
        selectedIds,
        this.pendingSyncTextElementIds.length ? this.pendingSyncTextElementIds : undefined,
      );
      alert(
        `${this.sectionSyncOnlyNewPhrases ? 'Frazele noi au fost adăugate' : 'Frazele lipsă au fost adăugate'} în ${selectedIds.length} secțiuni (${insertedCount} legături audio noi).`,
      );
      this.closeSectionSyncModal();
      await this.refreshSectionSyncAvailability();
    } catch (error: any) {
      alert('Nu am putut actualiza secțiunile: ' + (error?.message ?? error));
    } finally {
      this.sectionSyncApplying = false;
    }
  }

  skipSectionSync() {
    this.closeSectionSyncModal();
  }

  goBack() {
    history.back();
  }

  async deleteText() {
    if (!this.text) return;
    if (!confirm('Ești sigur că vrei să ștergi acest text? Nu îl poți recupera ulterior!')) return;

    try {
      await this.litTextService.delete(this.text.id);
      location.href = '/liturgicalTexts';
    } catch (error) {
      console.error('Error deleting text:', error);
    }
  }

  secondsToTimeFormat(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
  }
}
