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

  constructor(private litTextService: LiturgicalTextsService) {}

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.liturgicalTexts = await this.litTextService.getAll();
  }

  async addLitirgucalText(): Promise<void> {
    const title = this.newLiturgicalTextName.trim();
    if (!title) return;

    try {
      let result = await this.litTextService.create({
        title: title,
      });
      this.newLiturgicalTextName = '';
      this.liturgicalTexts.splice(0, 0, result);
    } catch (error) {
      alert('Error creating root type: ' + error);
    }
  }

}
