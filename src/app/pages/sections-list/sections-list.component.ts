// src/app/pages/sections-list/sections-list.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SectionsService } from '../../core/services/sections.service';
import { Section } from '../../core/models/section.model';


@Component({
  standalone: true,
  selector: 'app-sections-list',
  templateUrl: './sections-list.component.html',
  styleUrls: ['./sections-list.component.css'],
  imports: [CommonModule, FormsModule, RouterLink],
})
export class SectionsListComponent implements OnInit {
  sections: Section[] = [];
  newSectionTitle = '';

  constructor(private sectionsService: SectionsService) {}

  async ngOnInit(): Promise<void> {
    await this.loadSections();
  }

  async loadSections() {
    this.sections = await this.sectionsService.getAll();
  }

  async addSection() {
    const title = this.newSectionTitle.trim();
    if (!title) return;
    try {
      await this.sectionsService.create({
        title,
        audio_url: '',
        subtitle: null,
        duration: 500,
        image_url: null,
      } as Partial<Section>);
      this.newSectionTitle = '';
      await this.loadSections();
    } catch (error) {
      console.error('Eroare la crearea noii secțiuni:', error);
    }
  }
}
