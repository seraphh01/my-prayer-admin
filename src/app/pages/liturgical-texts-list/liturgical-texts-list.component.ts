// src/app/pages/liturgical-texts-list/liturgical-texts-list.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LiturgicalTextsService } from '../../core/services/liturgical-text.service';
import { LiturgicalText } from '../../core/models/liturgical-text.model';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-liturgical-texts-list',
  templateUrl: './liturgical-texts-list.component.html',
  styleUrls: ['./liturgical-texts-list.component.css'],
  imports: [CommonModule, RouterLink, FormsModule],
})
export class LiturgicalTextsListComponent implements OnInit {
  liturgicalTexts: LiturgicalText[] = [];
  newLiturgicalTextName = '';

  searchText = '';
  currentPage = 1;
  totalPages = 1;
  pageSize = 10;
  constructor(private litTextService: LiturgicalTextsService) {}

  async ngOnInit(): Promise<void> {
    await this.loadData();
    await this.getTotalPages();
  }

  async getTotalPages(): Promise<void> {
    const count = await this.litTextService.count();
    this.totalPages = Math.ceil(count / this.pageSize);
  }

  async loadData(): Promise<void> {
    this.liturgicalTexts = await this.litTextService.getPaginated(this.currentPage, this.pageSize, this.searchText.length ? [{field: 'title', operator:'ilike', value: `%${this.searchText}%`}] : []);
  }

  async addLitirgucalText(): Promise<void> {
    const title = this.newLiturgicalTextName.trim() ?? null;

    try {
      let result = await this.litTextService.create({
        title: title.length > 0 ? title : undefined,
      });
      this.newLiturgicalTextName = '';
      this.liturgicalTexts.splice(0, 0, result);
    } catch (error) {
      alert('Error creating root type: ' + error);
    }
  }

  async searchByTitle(): Promise<void> {
    if (this.searchText.length === 0) {
      await this.loadData();
      await this.getTotalPages();
      return;
    }

    this.currentPage = 1;
    this.totalPages = 1;


    this.loadData();
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadData();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadData();
    }
  }

  changedPageSize(): void {
    this.currentPage = 1;
    this.loadData();
    this.getTotalPages();
  }

}
