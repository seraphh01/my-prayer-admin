import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Prayer } from '../../core/models/prayer.model';
import { PrayersService } from '../../core/services/prayers.service';
import { FormsModule } from '@angular/forms';
import { PrayerType } from '../../core/models/prayer-type.model';
import { PrayerTypeService } from '../../core/services/prayer-type.service';


@Component({
  standalone: true,
  selector: 'app-prayers-list',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './prayers-list.component.html',
  styleUrls: ['./prayers-list.component.css'],
})
export class PrayersListComponent implements OnInit {
  prayerTypes: PrayerType[] = [];
  prayers: Prayer[] = [];
  newPrayer: Prayer | null = null;

  constructor(private prayersService: PrayersService, private prayerTypesService: PrayerTypeService) {}

  async ngOnInit(): Promise<void> {
    this.newPrayer = {title: '', subtitle: '', sequence: 1} as any;
    this.prayers = await this.prayersService.getAll();
    this.prayerTypes = await this.prayerTypesService.getAll();
  }

  addPrayer(): void {
    const title = this.newPrayer?.title.trim();
    const subtitle = this.newPrayer?.subtitle!.trim();
    const sequence = this.newPrayer?.sequence;
    if (!title) return;

    this.prayersService.create({
      title: title,
      subtitle: subtitle,
      sequence: sequence,
      prayer_type_id: this.newPrayer?.prayer_type_id,
    }).then((result) => {
      this.newPrayer = {title: '', subtitle: '', sequence: 1} as any;
      this.prayers.splice(0, 0, result);
    }).catch((error) => {
      alert('Error creating prayer: ' + error);
    });
  }
}
