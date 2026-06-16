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
  searchText = '';

  currentPage = 1;
  totalPages = 1;
  pageSize = 10;

  constructor(private sectionsService: SectionsService) {}

  async ngOnInit(): Promise<void> {
    await this.loadSections();
    await this.getTotalPages();
  }

  private getFilters(): { field: string; operator: string; value: string }[] {
    const query = this.searchText.trim();
    if (!query.length) return [];

    return [{ field: 'title', operator: 'ilike', value: `%${query}%` }];
  }

  async getTotalPages(): Promise<void> {
    const count = await this.sectionsService.countFiltered(this.getFilters());
    this.totalPages = Math.max(1, Math.ceil(count / this.pageSize));
  }

  async loadSections() {
    this.sections = await this.sectionsService.getPaginated(
      this.currentPage,
      this.pageSize,
      this.getFilters(),
    );
  }

  async searchByTitle(): Promise<void> {
    this.currentPage = 1;
    await this.loadSections();
    await this.getTotalPages();
  }

  async addSection() {
    const title = this.newSectionTitle.trim();
    if (!title) return;
    try {
      await this.sectionsService.create({
        title,
        audio_url: '',
        subtitle: null,
        image_url: null,
      } as Partial<Section>);
      this.newSectionTitle = '';
      this.currentPage = 1;
      await this.loadSections();
      await this.getTotalPages();
    } catch (error) {
      console.error('Eroare la crearea noii secțiuni:', error);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadSections();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadSections();
    }
  }

  changedPageSize(): void {
    this.currentPage = 1;
    this.loadSections();
    this.getTotalPages();
  }
}
