// src/app/pages/liturgical-text-detail/liturgical-text-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { LiturgicalText } from '../../core/models/liturgical-text.model';
import { TextElement, TextElementType } from '../../core/models/text-element.model';
import { LiturgicalTextsService } from '../../core/services/liturgical-text.service';
import { TextElementsService } from '../../core/services/text-element.service';
import { TimeInputDirective } from '../../core/directives/time-input.directive';
import { TimePipe } from '../../core/directives/time.pipe';

@Component({
  standalone: true,
  selector: 'app-liturgical-text-detail',
  templateUrl: './liturgical-text-detail.component.html',
  styleUrls: ['./liturgical-text-detail.component.css'],
  imports: [CommonModule, FormsModule, TimeInputDirective, TimePipe],
})
export class LiturgicalTextDetailComponent implements OnInit {
  textId!: string;
  text: LiturgicalText | null = null;

  // Editing the litText title
  editedTitle = '';

  newTextElement: TextElement | null = null;
  editedTextElement: TextElement | null = null;

  sectionStartTime: number | null = 0;
  textTypes = Object.values(TextElementType);
  textTitle = '';

  constructor(
    private route: ActivatedRoute,
    private litTextService: LiturgicalTextsService,
    private textElementsService: TextElementsService
  ) {}

  async ngOnInit(): Promise<void> {
    this.textId = this.route.snapshot.paramMap.get('id') || '';
    this.sectionStartTime = parseInt(this.route.snapshot.paramMap.get('sectionStartTime') || '0');
    this.newTextElement = {text_id: this.textId, type: TextElementType.PLAIN} as TextElement;
    this.editedTextElement = {} as TextElement;
    await this.loadLiturgicalText();
  }

  /**
   * Loads the LiturgicalText (including the array of text elements if you want).
   */
  async loadLiturgicalText() {
    this.text = await this.litTextService.getById(this.textId);
    this.textTitle = this.text?.title ?? '';
    this.newTextElement!.start_time = this.text?.texts?.length ? this.text.texts[this.text.texts.length - 1].end_time! + this.sectionStartTime! : this.sectionStartTime;
  }

  /**
   * Loads text elements separately (sorted by sequence).
   */
  async loadTextElements() {
    if (!this.text) return;
    const { data, error } = await this.textElementsService.client
      .from('text_elements')
      .select('*')
      .eq('text_id', this.text.id)
      .order('sequence');

    if (!error && data) {
      // Ensure text has a texts array
      this.text.texts = data;
    }
  }

  /**
   * Update the litText's title in DB.
   */
  async saveTitle() {
    if(!this.text) return;
    try {
      const updated = await this.litTextService.update(this.text.id, {
        title: this.text.title ?? null,
        audio_time: this.text.audio_time,
      });
      if (updated) {
        alert('Textul a fost salvat!');
        this.textTitle = this.text.title ?? '';
      }
    } catch (error) {
      console.error('Error updating title:', error);
    }
  }

  /**
   * Add a new text element at the end (sequence = max + 1).
   */
  async addTextElement() {
    if (!this.textId) return;
    const trimmedText = this.newTextElement?.text.trim();
    if (!trimmedText) return;

    try {
      // Find max sequence among existing elements
      let maxSeq = 0;
      if (this.text?.texts && this.text.texts.length > 0) {
        maxSeq = Math.max(...this.text.texts.map((te) => te.sequence));
      }

      await this.textElementsService.create({
        text: trimmedText,
        sequence: maxSeq + 1,
        text_id: this.textId,
        type: this.newTextElement?.type ?? TextElementType.PLAIN,
        highlight: this.newTextElement?.highlight ?? false,
        start_time:  (this.newTextElement?.start_time ?? 0) - (this.sectionStartTime ?? 0),
        end_time: (this.newTextElement?.end_time ?? 0)- (this.sectionStartTime ?? 0) ,
      });
      this.newTextElement = {text_id: this.textId, start_time: this.newTextElement?.end_time, end_time:this.newTextElement?.end_time, type: TextElementType.PLAIN} as TextElement;
      // Reload elements from DB so they appear at the end
      await this.loadTextElements();
    } catch (error) {
      console.error('Error adding text element:', error);
    }
  }

  goBack() {
    history.back();
  }

  async deleteText() {
    if (!this.text) return;
    if (!confirm('Ești sigur că vrei să ștergi acest text? Nu îl poți recupera ulterior!')) return;

    try {
      await this.litTextService.delete(this.text.id);
      // Redirect to the list page
      location.href = '/liturgicalTexts';
    } catch (error) {
      console.error('Error deleting text:', error);
    }
  }

  /**
   * Delete an existing text element by ID.
   * index is the position in the array, used to remove it from local state if desired.
   */
  async deleteTextElement(id: string, index: number) {
    if (!confirm('Ești sigur că vrei să ștergi acest text? Nu îl poți recupera ulterior!')) return;
    try {
      await this.textElementsService.delete(id);
      // Remove from local array so the UI updates immediately
      this.text?.texts?.splice(index, 1);
      this.newTextElement!.start_time = this.text?.texts?.length ? (this.text.texts[this.text.texts.length - 1].end_time ?? 0) + (this.sectionStartTime ?? 0) : 0;
      this.newTextElement!.end_time = this.text?.texts?.length ? (this.text.texts[this.text.texts.length - 1].end_time ?? 0) + (this.sectionStartTime ?? 0) : 0;
    } catch (error) {
      console.error('Error deleting text element:', error);
    }
  }

  setEditedTextElement(te: TextElement) {
    this.editedTextElement = { ...te };
    this.editedTextElement.start_time! += this.sectionStartTime ?? 0;
    this.editedTextElement.end_time! += this.sectionStartTime ?? 0;
  }

  clearEditedTextElement() {
    this.editedTextElement = {} as TextElement;
  }

  async editTextElement(index: number) {
    if (!this.editedTextElement?.id || !this.editedTextElement.text) return;
    try {
      this.editedTextElement.start_time! -= this.sectionStartTime ?? 0;
      this.editedTextElement.end_time! -= this.sectionStartTime ?? 0;
      await this.textElementsService.update(this.editedTextElement.id, { ...this.editedTextElement });
      // Update local array so the UI updates immediately
      this.text?.texts?.splice(index, 1, { ...this.editedTextElement });
      this.editedTextElement = {} as TextElement;
    } catch (error: any) {
      alert('A intervenit o eroare: ' + error.message);
    }
  }

  /**
   * Swap sequence with the previous item (move up).
   */
  async moveUp(index: number) {
    if (!this.text?.texts || index === 0) return; // can't move up if first
    const current = this.text.texts[index];
    const prev = this.text.texts[index - 1];

    try {
      // Swap sequences
      const tempSeq = current.sequence;
      current.sequence = prev.sequence;
      prev.sequence = tempSeq;

      // Update both in DB
      await this.textElementsService.update(current.id, {
        sequence: current.sequence,
      });
      await this.textElementsService.update(prev.id, {
        sequence: prev.sequence,
      });

      // Swap them in local array
      this.text.texts[index] = prev;
      this.text.texts[index - 1] = current;
    } catch (error) {
      console.error('Error moving element up:', error);
    }
  }

  /**
   * Swap sequence with the next item (move down).
   */
  async moveDown(index: number) {
    if (!this.text?.texts || index === this.text.texts.length - 1) return; // can't move down if last
    const current = this.text.texts[index];
    const next = this.text.texts[index + 1];

    try {
      // Swap sequences
      const tempSeq = current.sequence;
      current.sequence = next.sequence;
      next.sequence = tempSeq;

      // Update both in DB
      await this.textElementsService.update(current.id, {
        sequence: current.sequence,
      });
      await this.textElementsService.update(next.id, {
        sequence: next.sequence,
      });

      // Swap them locally
      this.text.texts[index] = next;
      this.text.texts[index + 1] = current;
    } catch (error) {
      console.error('Error moving element down:', error);
    }
  }

  secondsToTimeFormat(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' + secs : secs}`;
  }
}
