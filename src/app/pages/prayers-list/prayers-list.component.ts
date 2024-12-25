import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Prayer } from '../../core/models/prayer.model';
import { PrayersService } from '../../core/services/prayers.service';


@Component({
  standalone: true,
  selector: 'app-prayers-list',
  imports: [CommonModule, RouterLink],
  templateUrl: './prayers-list.component.html',
  styleUrls: ['./prayers-list.component.css'],
})
export class PrayersListComponent implements OnInit {
  prayers: Prayer[] = [];

  constructor(private prayersService: PrayersService) {}

  async ngOnInit(): Promise<void> {
    this.prayers = await this.prayersService.getAll();
  }
}
