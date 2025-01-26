// src/app/pages/section-detail/section-detail.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LiturgicalText } from '../../core/models/liturgical-text.model';
import { SectionText, SectionTextElement } from '../../core/models/section-text.model';
import { Section } from '../../core/models/section.model';
import { LiturgicalTextsService } from '../../core/services/liturgical-text.service';
import { SectionTextsService } from '../../core/services/section-texts.service';
import { SectionsService } from '../../core/services/sections.service';
import { TimeInputDirective } from '../../core/directives/time-input.directive';
import { TimePipe } from '../../core/directives/time.pipe';
import { AudioPlayerComponent } from "./audio-player/audio-player.component";
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SectionTextElementsService } from '../../core/services/section-text-elements.service';
import { SupabaseService } from '../../core/services/supabase.service';


@Component({
  standalone: true,
  selector: 'app-section-detail',
  templateUrl: './section-details.component.html',
  styleUrls: ['./section-details.component.css'],
  imports: [CommonModule, FormsModule, RouterLink, TimeInputDirective, TimePipe, MatInputModule, MatFormFieldModule],
})
export class SectionDetailsComponent implements OnInit {
  sectionId!: string;
  section: Section | null = null;
  sectionTexts: SectionText[] = []; // For the many-to-many relationship

  allLitTexts: LiturgicalText[] = []; // Loaded for adding new texts

  // Editable fields for the section
  editedTitle = '';
  editedSubtitle = '';
  editedAudioUrl = '';
  editedImageUrl = '';

  audio = new Audio();

  // For adding a new text
  selectedLitTextId = 'new';
  newStartTime: number | null = 0;
  newEndTime: number | null = 0;
  newRepetitions = 1;
  timeOut: any;
  newLiturgicalTextTitle: string = '';

  editingSectionText: SectionText | null = null;
  currentTime: number = 0;
  uploadedFile: File | null = null;
  floor = Math.floor;
  playingSectionText: SectionText | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sectionsService: SectionsService,
    private sectionTextsService: SectionTextsService,
    private litTextsService: LiturgicalTextsService,
    private sectionTextElementsService: SectionTextElementsService,
    private supabaseService: SupabaseService
  ) { }

  async ngOnInit(): Promise<void> {
    this.sectionId = this.route.snapshot.paramMap.get('id') || '';
    await this.loadSection();
    await this.loadAllLitTexts();
    await this.loadSectionTexts();
  }

  /**
   * Fetch the Section by ID. Once loaded, populate the local editing fields.
   */
  async loadSection() {
    this.section = await this.sectionsService.getById(this.sectionId);
    if (this.section) {
      this.audio.src = this.section.audio_url;
      this.audio.ontimeupdate = () => {
        this.currentTime = this.audio.currentTime;
      }
      this.editedTitle = this.section.title || '';
      this.editedSubtitle = this.section.subtitle || '';
      this.editedAudioUrl = this.section.audio_url;
      this.editedImageUrl = this.section.image_url || '';
    }
  }

  async deleteSection() {
    if (!confirm('Șterge această secțiune?')) return;
    try {
      await this.sectionsService.delete(this.sectionId);
      alert('Secțiune ștearsă cu succes!');
      this.router.navigate(['/sections']);
    } catch (error) {
      console.error('Eroare la ștergere:', error);
    }
  }

  /**
   * Load all liturgical texts for the dropdown
   */
  async loadAllLitTexts() {
    this.allLitTexts = await this.litTextsService.getAll();
  }

  /**
   * Load section_texts for the current section
   */
  async loadSectionTexts() {
    // Example direct query to the supabase client
    const { data, error } = await this.sectionTextsService.client
      .from('section_texts')
      .select('*, text: liturgical_texts(*, texts: text_elements(*)), section_text_elements: section_text_elements(*, text_element: text_elements(*))') // Include the liturgical_text
      .eq('prayer_section_id', this.sectionId) // or "section_id"
      .order('sequence', { ascending: true })
      .order('sequence', { ascending: true, foreignTable: 'liturgical_texts.text_elements' })
      .order('sequence', { ascending: true, foreignTable: 'section_text_elements' });

    if (!error && data) {
      this.sectionTexts = data;

      this.newStartTime = this.sectionTexts.length > 0 ? this.sectionTexts[this.sectionTexts.length - 1].end_time : 0;
    }
  }

  /**
   * Save all edited fields in a single request
   */
  async saveSection() {
    if (!this.section) return;

    if(this.uploadedFile) {
      
      const path = this.uploadedFile.name;
      try {

        let result = await this.supabaseService.uploadFile(this.uploadedFile, path);
        this.editedAudioUrl = result;
      } catch (error: any) {
        alert('Eroare la încărcarea fișierului: ' + error.name + ' - ' + error.message);
      }
    }

    // Gather all changed fields
    const updateData: Partial<Section> = {
      title: this.editedTitle.trim() || null,
      subtitle: this.editedSubtitle.trim() || null,
      audio_url: this.editedAudioUrl.trim(),
      image_url: this.editedImageUrl.trim() || null,
    };

    try {
      const updated = await this.sectionsService.update(this.section.id, updateData);
      if (updated) {
        // Update local data to reflect changes
        this.section.title = updated.title;
        this.section.subtitle = updated.subtitle;
        this.section.audio_url = updated.audio_url;
        this.section.image_url = updated.image_url;

        alert('Secțiune salvată cu succes!');
      }
    } catch (error) {
      console.error('Eroare la salvarea secțiunii:', error);
    }
  }

  /**
   * Add a new text to this section with max(sequence) + 1
   */
  async addLiturgicalTextToSection() {
    if (!this.selectedLitTextId) return;

    let maxSeq = 0;
    if (this.sectionTexts.length > 0) {
      maxSeq = Math.max(...this.sectionTexts.map((st) => st.sequence));
    }

    try {

      if (this.selectedLitTextId === 'new') {
        const newLitText = await this.litTextsService.create({
          title: this.newLiturgicalTextTitle,
        } as Partial<LiturgicalText>);
        this.selectedLitTextId = newLitText.id;
      }

      let result = await this.sectionTextsService.create({
        prayer_section_id: this.sectionId,
        liturgical_text_id: this.selectedLitTextId,
        sequence: maxSeq + 1,
        repetition: this.newRepetitions,
        start_time: this.newStartTime ?? null,
        end_time: this.newEndTime ?? null,
      } as Partial<SectionText>);

      //retrieve section_text_elements
      let {data, error} = await this.sectionTextElementsService.client
      .from('section_text_elements')
      .select('*, text_element: text_elements(*)')
      .eq('section_text_id', result.id)
      .order('sequence', { ascending: true });
      
      if (!error){
        result.section_text_elements = data;
      }

      this.newStartTime = result.end_time ?? 0;
      this.newEndTime = (result.end_time?? 0) + 60;

      // Reload
      this.sectionTexts.push(result);
    } catch (error) {
      console.error('Eroare la adăugarea textului:', error);
    }
  }

  /**
   * Delete a text from the join table
   */
  async deleteSectionText(st: SectionText, index: number) {
    if (!confirm('Șterge acest text din secțiune?')) return;
    try {
      await this.sectionTextsService.delete(st.id);
      this.sectionTexts.splice(index, 1);
    } catch (error) {
      console.error('Eroare la ștergere:', error);
    }
  }

  /**
   * Reorder up
   */
  async moveUp(index: number) {
    if (index === 0) return;
    const current = this.sectionTexts[index];
    const prev = this.sectionTexts[index - 1];

    const tempSeq = current.sequence;
    current.sequence = prev.sequence;
    prev.sequence = tempSeq;

    try {
      await this.sectionTextsService.update(current.id, { sequence: current.sequence });
      await this.sectionTextsService.update(prev.id, { sequence: prev.sequence });
      // Swap in array
      this.sectionTexts[index] = prev;
      this.sectionTexts[index - 1] = current;
    } catch (error) {
      console.error('Eroare la mutare în sus:', error);
    }
  }

  /**
   * Reorder down
   */
  async moveDown(index: number) {
    if (index === this.sectionTexts.length - 1) return;
    const current = this.sectionTexts[index];
    const next = this.sectionTexts[index + 1];

    const tempSeq = current.sequence;
    current.sequence = next.sequence;
    next.sequence = tempSeq;

    try {
      await this.sectionTextsService.update(current.id, { sequence: current.sequence });
      await this.sectionTextsService.update(next.id, { sequence: next.sequence });
      // Swap in array
      this.sectionTexts[index] = next;
      this.sectionTexts[index + 1] = current;
    } catch (error) {
      console.error('Eroare la mutare în jos:', error);
    }
  }

  setEditingSectionText(st: SectionText) {
    this.editingSectionText = JSON.parse(JSON.stringify(st)) as SectionText;
    this.editingSectionText.section_text_elements?.forEach((ste) => {
      ste.start_time = (this.editingSectionText?.start_time ?? 0) + ste.start_time;
      ste.end_time = (this.editingSectionText?.start_time ?? 0) + ste.end_time;
    });
    this.stopPlayingSectionText();
  }

  clearEditingSectionText() {
    this.editingSectionText = null;
  }

  async saveEditedSectionText() {
    if (!this.editingSectionText) return;
    let updatedSectionText = await this.sectionTextsService.update(this.editingSectionText.id, {
      start_time: this.editingSectionText.start_time,
      end_time: this.editingSectionText.end_time,
      repetition: this.editingSectionText.repetition,
    });

    let editedSectionText = this.sectionTexts.find((st) => st.id === this.editingSectionText?.id);

    let bulkUpdateSectionTextElements = this.editingSectionText.section_text_elements?.map((text) => ({ start_time: text.start_time - (this.editingSectionText?.start_time ?? 0), end_time: text.end_time - (this.editingSectionText?.start_time ?? 0), text_element_id: text.text_element_id, section_text_id: text.section_text_id } as SectionTextElement)) ?? [];
    await this.sectionTextElementsService.bulkUpdate(bulkUpdateSectionTextElements);

    editedSectionText!.section_text_elements = this.editingSectionText.section_text_elements?.map((text) => ({ start_time: text.start_time - (this.editingSectionText?.start_time ?? 0), end_time: text.end_time - (this.editingSectionText?.start_time ?? 0), text_element_id: text.text_element_id, section_text_id: text.section_text_id, text_element: text.text_element } as SectionTextElement)) ?? [];;
  

    editedSectionText!.repetition = updatedSectionText.repetition;
    editedSectionText!.start_time = updatedSectionText.start_time;
    editedSectionText!.end_time = updatedSectionText.end_time;
    this.editingSectionText = null;
  }

  /**
   * Go back to the sections list
   */
  goBack() {
    window.history.back();
  }

  // Handle file selection
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (file) {
      this.uploadedFile = file;
      this.editedAudioUrl = file.name;
    } else {
      this.uploadedFile = null;
    }
  }

  onLitTextSelected(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedLitTextId = select.value;
    let text = this.allLitTexts.find((lt) => lt.id === this.selectedLitTextId);
    this.newEndTime = (this.newStartTime ?? 0);
  }

  playAudioPart(start: number, end: number) {
    
    if(!this.section || !this.section.audio_url?.length) return;

    if(this.audio.src !== this.section?.audio_url) {
      this.audio.src = this.section?.audio_url ?? '';
    }

    if (this.audio.paused || this.audio.currentTime >= end || this.audio.currentTime < start) {
      clearTimeout(this.timeOut);
      this.currentTime = start;
      this.audio.currentTime = start;
      this.audio.play();
      this.audio.loop = false;
          //stop at end
          this.timeOut  = setTimeout(() => {
            this.audio.pause();
          }, (end - start) * 1000);
      
    }
    else {
      this.audio.pause();
      clearTimeout(this.timeOut);
      this.currentTime = 0;
    }
  }

  forcePlayAudioPart(start: number, end: number) {
    clearTimeout(this.timeOut);
    this.audio.pause();
    this.audio.currentTime = start;
    this.audio.play();
    this.audio.loop = false;
    //stop at end
    this.timeOut  = setTimeout(() => {
      this.currentTime = 0;
      this.audio.pause();
      this.playingSectionText = null;
    }, (end - start) * 1000);
  }

  playSectionText(st: SectionText) {

    if(this.playingSectionText != null && this.playingSectionText.id === st.id) {
      if(this.audio.paused) {
        this.audio.play()
      } else {

      this.audio.pause();}
      return;
    }

    this.playingSectionText = st;
    
    this.playAudioPart(st.start_time ?? 0, st.end_time ?? 0);

  }

  pauseSectionText() {
    this.audio.pause();
  }

  stopPlayingSectionText() {
    this.audio.pause();
    clearTimeout(this.timeOut);
    this.currentTime = 0;
    this.playingSectionText = null;
  }

  onTextElementStartTimeChanged(index: number) {
    if (!this.editingSectionText) return;
    let ste = this.editingSectionText.section_text_elements![index];

    if(index === 0) {
      this.editingSectionText.start_time = ste.start_time;
    }

    if (index > 0) {
      let previousTextElement = this.editingSectionText.section_text_elements![index - 1];


      previousTextElement.end_time = ste.start_time;
    }

    if(ste.end_time <= ste.start_time) {
      ste.end_time = ste.start_time + 60;
    }

    this.forcePlayAudioPart(ste.start_time, ste.end_time);
  }

  onTextElementEndTimeChanged(index: number) {
    if (!this.editingSectionText) return;
    let ste = this.editingSectionText.section_text_elements![index];

    if(index === this.editingSectionText.section_text_elements!.length - 1) {
      this.editingSectionText.end_time = ste.end_time;
    }

    if (index < this.editingSectionText.section_text_elements!.length - 1) {
      let nextTextElement = this.editingSectionText.section_text_elements![index + 1];
      nextTextElement.start_time = ste.end_time;

      if(nextTextElement.end_time <= nextTextElement.start_time) {
        nextTextElement.end_time = nextTextElement.start_time + 60;
      }

      this.forcePlayAudioPart(nextTextElement.start_time, nextTextElement.end_time);
    }
  }

  setEndTimeToCurrentTime(index: number) {
    if (!this.editingSectionText) return;
    if (index >= this.editingSectionText.section_text_elements!.length) return;
    if (index < 0) return;

    let ste = this.editingSectionText.section_text_elements![index];
    ste.end_time = Math.floor(this.currentTime);
    this.onTextElementEndTimeChanged(index);
  }
}
