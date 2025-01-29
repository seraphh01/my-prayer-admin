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
import { TextElement, TextElementType } from '../../core/models/text-element.model';
import { TextElementsService } from '../../core/services/text-element.service';


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

  textTypes = Object.values(TextElementType);
  allLitTexts: LiturgicalText[] = []; // Loaded for adding new texts

  // Editable fields for the section
  editedTitle = '';
  editedSubtitle = '';
  editedAudioUrl = '';
  editedImageUrl = '';

  audio = new Audio();

  // For adding a new text

  timeOut: any;

  newSectionText: SectionText = {} as any;
  newLiturgicalText: LiturgicalText = {} as any;

  editingSectionTexts: SectionText[] = [];
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
    private textElementsService: TextElementsService,
    private supabaseService: SupabaseService
  ) { }

  async ngOnInit(): Promise<void> {
    this.sectionId = this.route.snapshot.paramMap.get('id') || '';
    this.newSectionText = { prayer_section_id: this.sectionId, sequence: 0, liturgical_text_id: 'new', repetition: 1 } as SectionText;

    this.newLiturgicalText = { texts: [] } as any;    this.addTextElementToNewLiturgicalText();
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

      this.newSectionText!.start_time = this.sectionTexts.length > 0 ? this.sectionTexts[this.sectionTexts.length - 1].end_time : 0;
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
        this.editedAudioUrl = "";
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
    if (!this.newSectionText.liturgical_text_id) return;

    let maxSeq = 0;
    if (this.sectionTexts.length > 0) {
      maxSeq = Math.max(...this.sectionTexts.map((st) => st.sequence));
    }

    try {

      if (this.newSectionText.liturgical_text_id === 'new') {
        const newLitText = await this.litTextsService.create({
          title: this.newLiturgicalText.title,
        } as Partial<LiturgicalText>);
        this.newLiturgicalText.texts.forEach((text) => text.text_id = newLitText.id);
        await this.textElementsService.bulkUpdate(this.newLiturgicalText.texts);
        this.newSectionText.liturgical_text_id = newLitText.id;
        this.newLiturgicalText = { texts: [] } as any;
      }

      let result = await this.sectionTextsService.create({
        prayer_section_id: this.sectionId,
        liturgical_text_id: this.newSectionText.liturgical_text_id,
        sequence: maxSeq + 1,
        repetition: this.newSectionText.repetition ?? 1,
        start_time: this.newSectionText.start_time ?? null,
        end_time: this.newSectionText.end_time ?? null,
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

      this.newSectionText.start_time = result.end_time ?? 0;
      this.newSectionText.end_time = (result.end_time?? 0) + 60;

      // Reload
      this.sectionTexts.push(result);
      if(this.editingSectionTexts.length){
        this.addEditingSectionText(result);
      }
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

  editAllSectionTexts() {
    this.editingSectionTexts = JSON.parse(JSON.stringify(this.sectionTexts));
    this.editingSectionTexts.forEach((st) => {
      st.section_text_elements?.forEach((ste) => {
        ste.start_time = (st?.start_time ?? 0) + ste.start_time;
        ste.end_time = (st?.start_time ?? 0) + ste.end_time;
      });
    });
  }

  cancelAllEditedSectionTexts() {
    this.editingSectionTexts = [];
  }

  addEditingSectionText(st: SectionText) {
    var sectionTextCopy = JSON.parse(JSON.stringify(st)) as SectionText;
    sectionTextCopy.section_text_elements?.forEach((ste) => {
      ste.start_time = (sectionTextCopy?.start_time ?? 0) + ste.start_time;
      ste.end_time = (sectionTextCopy?.start_time ?? 0) + ste.end_time;
    });
    this.editingSectionTexts.push(sectionTextCopy);
  }

  removeEditingSectionText(sectionId: number) {
    let index = this.editingSectionTexts.findIndex((st) => st.id === sectionId);
    if (index >= 0) {
      this.editingSectionTexts.splice(index, 1);
    }
  }

  async saveSingleEditedSectionText(sectionId: number) {
    let index = this.editingSectionTexts.findIndex((st) => st.id === sectionId);
    if (index < 0) return;
    let editingSectionText = this.editingSectionTexts[index];
    let updatedSectionText = await this.sectionTextsService.update(editingSectionText.id, {
      start_time: editingSectionText.start_time,
      end_time: editingSectionText.end_time,
      repetition: editingSectionText.repetition,
    });

    let editedSectionText = this.sectionTexts.find((st) => st.id === editingSectionText?.id);

    let deletedSectionTextElements = editedSectionText?.section_text_elements?.filter((text) => !editingSectionText.section_text_elements?.find((ste) => ste.text_element_id === text.text_element_id)) ?? [];
    
    if(deletedSectionTextElements.length) {
      await this.sectionTextElementsService.deleteMany(deletedSectionTextElements);
      editedSectionText!.section_text_elements = editedSectionText?.section_text_elements?.filter((text) => !deletedSectionTextElements.find((ste) => ste.text_element_id === text.text_element_id)) ?? [];
    }
    
    let bulkUpdateSectionTextElements = editingSectionText.section_text_elements?.map((text) => ({ start_time: text.start_time - (editingSectionText?.start_time ?? 0), end_time: text.end_time - (editingSectionText?.start_time ?? 0), text_element_id: text.text_element_id, section_text_id: text.section_text_id } as SectionTextElement)) ?? [];
    await this.sectionTextElementsService.bulkUpdate(bulkUpdateSectionTextElements);

    editedSectionText!.section_text_elements = editingSectionText.section_text_elements?.map((text) => ({ start_time: text.start_time - (editingSectionText?.start_time ?? 0), end_time: text.end_time - (editingSectionText?.start_time ?? 0), text_element_id: text.text_element_id, section_text_id: text.section_text_id, text_element: text.text_element } as SectionTextElement)) ?? [];
    editedSectionText!.repetition = updatedSectionText.repetition;
    editedSectionText!.start_time = updatedSectionText.start_time;
    editedSectionText!.end_time = updatedSectionText.end_time;
    
    this.editingSectionTexts.splice(index, 1);
  }

  async saveAllEditedSectionTexts() {
    for (let i = 0; i < this.editingSectionTexts.length; i++) {
      let editingSectionText = this.editingSectionTexts[i];
      let updatedSectionText = await this.sectionTextsService.update(editingSectionText.id, {
        start_time: editingSectionText.start_time,
        end_time: editingSectionText.end_time,
        repetition: editingSectionText.repetition,
      });

      let editedSectionText = this.sectionTexts.find((st) => st.id === editingSectionText?.id);

      let deletedSectionTextElements = editedSectionText?.section_text_elements?.filter((text) => !editingSectionText.section_text_elements?.find((ste) => ste.text_element_id === text.text_element_id)) ?? [];
    
      if(deletedSectionTextElements.length) {
        await this.sectionTextElementsService.deleteMany(deletedSectionTextElements);
        editedSectionText!.section_text_elements = editedSectionText?.section_text_elements?.filter((text) => !deletedSectionTextElements.find((ste) => ste.text_element_id === text.text_element_id)) ?? [];
      }

      let bulkUpdateSectionTextElements = editingSectionText.section_text_elements?.map((text) => ({ start_time: text.start_time - (editingSectionText?.start_time ?? 0), end_time: text.end_time - (editingSectionText?.start_time ?? 0), text_element_id: text.text_element_id, section_text_id: text.section_text_id } as SectionTextElement)) ?? [];
      await this.sectionTextElementsService.bulkUpdate(bulkUpdateSectionTextElements);

      editedSectionText!.section_text_elements = editingSectionText.section_text_elements?.map((text) => ({ start_time: text.start_time - (editingSectionText?.start_time ?? 0), end_time: text.end_time - (editingSectionText?.start_time ?? 0), text_element_id: text.text_element_id, section_text_id: text.section_text_id, text_element: text.text_element } as SectionTextElement)) ?? [];
      editedSectionText!.repetition = updatedSectionText.repetition;
      editedSectionText!.start_time = updatedSectionText.start_time;
      editedSectionText!.end_time = updatedSectionText.end_time;
    }
    this.editingSectionTexts = [];
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
    this.newSectionText.liturgical_text_id = select.value;
    this.newSectionText.end_time = (this.newSectionText.start_time ?? 0);
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

  onTextElementStartTimeChanged(sectionId: number, index: number) {
    let actualIndex = this.sectionTexts.findIndex((st) => st.id === sectionId);
    let previousSectionTextId =  actualIndex > 0 ? this.sectionTexts[actualIndex - 1]?.id : null;

    let editingSectionText = this.editingSectionTexts.find((st) => st.id === sectionId);
    let previousEditingSectionText = this.editingSectionTexts.find((st) => st.id === previousSectionTextId);

    if (!editingSectionText) return;
    let ste = editingSectionText.section_text_elements![index];

    if(index === 0) {
      editingSectionText.start_time = ste.start_time;

      if(previousEditingSectionText != null) {
        previousEditingSectionText.end_time = ste.start_time;

        if(previousEditingSectionText.section_text_elements?.length) {
          let lastTextElement = previousEditingSectionText.section_text_elements![previousEditingSectionText.section_text_elements!.length - 1];
          lastTextElement.end_time = ste.start_time;
        }
      }
    }

    if (index > 0) {
      let previousTextElement = editingSectionText.section_text_elements![index - 1];


      previousTextElement.end_time = ste.start_time;
    }

    if(ste.end_time <= ste.start_time) {
      ste.end_time = ste.start_time + 60;
    }

    this.forcePlayAudioPart(ste.start_time, ste.end_time);
  }

  onTextElementEndTimeChanged(sectionId: number, index: number) {
    let actualIndex = this.sectionTexts.findIndex((st) => st.id === sectionId);
    let nextSectionTextId =  actualIndex < this.sectionTexts.length - 1 ? this.sectionTexts[actualIndex + 1]?.id : null;

    let editingSectionText = this.editingSectionTexts.find((st) => st.id === sectionId);
    let nextEditingSectionText = this.editingSectionTexts.find((st) => st.id === nextSectionTextId);

    if (!editingSectionText) return;
    let ste = editingSectionText.section_text_elements![index];

    if(index === editingSectionText.section_text_elements!.length - 1) {
      editingSectionText.end_time = ste.end_time;
    }

    if (index < editingSectionText.section_text_elements!.length - 1) {
      let nextTextElement = editingSectionText.section_text_elements![index + 1];
      nextTextElement.start_time = ste.end_time;

      if(nextTextElement.end_time <= nextTextElement.start_time) {
        nextTextElement.end_time = nextTextElement.start_time + 60;
      }

      this.forcePlayAudioPart(nextTextElement.start_time, nextTextElement.end_time);
    } else if(index === editingSectionText.section_text_elements!.length - 1 && nextEditingSectionText != null) {
      nextEditingSectionText.start_time = ste.end_time;

      if(!nextEditingSectionText.end_time || nextEditingSectionText.end_time <= nextEditingSectionText.start_time) {
        nextEditingSectionText.end_time = nextEditingSectionText.start_time + 60;
      }

      let firstTextElement = nextEditingSectionText.section_text_elements![0];

      if(firstTextElement) {
        firstTextElement.start_time = nextEditingSectionText.start_time;
        if(firstTextElement.end_time <= firstTextElement.start_time) {
          firstTextElement.end_time = firstTextElement.start_time + 60;
        }
      }
      this.forcePlayAudioPart(firstTextElement.start_time, firstTextElement.end_time);
    }
  }

  setEndTimeToCurrentTime(sectionId: number, index: number) {
    let editingSectionText = this.editingSectionTexts.find((st) => st.id === sectionId);

    if (!editingSectionText) return;
    if (index >= editingSectionText.section_text_elements!.length) return;
    if (index < 0) return;

    let ste = editingSectionText.section_text_elements![index];
    ste.end_time = Math.floor(this.currentTime);
    this.onTextElementEndTimeChanged(sectionId, index);
  }

  addTextElementToNewLiturgicalText() {
    this.newLiturgicalText.texts.push({ text: '', sequence: this.newLiturgicalText.texts.length + 1, type: TextElementType.PLAIN, highlight: false } as TextElement);
  }

  deleteTextElementFromNewLiturgicalText(index: number) {
    this.newLiturgicalText.texts.splice(index, 1);
  }

  isEditingSectionText(sectionId: number) {
    return this.editingSectionTexts.find((st) => st.id === sectionId) != null;
  }

  getEditingSectionText(sectionId: number) : SectionText | undefined {
    return this.editingSectionTexts.find((st) => st.id === sectionId);
  }

  deleteSectionTextElement(sectionTextId: number, textElementIndex: number) {
    //ask for confirmation
    if (!confirm('Ștergi această frază de text din secțiune? (doar în această secțiune)')) return;

    let editingSectionText = this.editingSectionTexts.find((st) => st.id === sectionTextId);
    if (!editingSectionText) return;

    editingSectionText.section_text_elements?.splice(textElementIndex, 1);
  }
}
