import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Prayer } from '../../core/models/prayer.model';
import { PrayersService } from '../../core/services/prayers.service';


@Component({
  standalone: true,
  selector: 'app-prayer-detail',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './prayer-details.component.html',
  styleUrls: ['./prayer-details.component.css'],
})
export class PrayerDetailComponent implements OnInit {
  prayer: Prayer | null = null;
  id!: string;

  constructor(
    private route: ActivatedRoute,
    private prayersService: PrayersService
  ) {}

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.prayer = await this.prayersService.getById(this.id);
  }

  async updatePrayer() {
    if (!this.prayer) return;
    const updated = await this.prayersService.update(this.prayer.id, {
      title: this.prayer.title,
      subtitle: this.prayer.subtitle,
      sequence: this.prayer.sequence,
    });
    if (updated) {
      alert('Prayer updated successfully!');
    }
  }

  async deletePrayer() {
    if (!this.prayer) return;
    if (confirm('Are you sure you want to delete this prayer?')) {
      try {
        const success = await this.prayersService.delete(this.prayer.id);
        alert('Prayer deleted successfully!');
      } catch (error) {
        alert('There was an error deleting the prayer.');
      }
    }
  }
}
