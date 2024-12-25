import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrayerTypeService } from '../../core/services/prayer-type.service';
import { PrayerTypeSubitemComponent } from '../prayer-type-subitem/prayer-type-subitem.component';

@Component({
  standalone: true,
  selector: 'app-prayer-types-list',
  templateUrl: './prayer-types-list.component.html',
  styleUrls: ['./prayer-types-list.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    PrayerTypeSubitemComponent, // important
  ],
})
export class PrayerTypesListComponent implements OnInit {
  prayerTypes: any[] = [];
  newRootTypeName = '';

  constructor(private prayerTypeService: PrayerTypeService) {}

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    try {
      this.prayerTypes = await this.prayerTypeService.getAll();
    } catch (error) {
      console.error('Error loading prayer types:', error);
    }
  }

  /**
   * Add a new root type (parent_type_id = null).
   */
  async addRootType(): Promise<void> {
    const name = this.newRootTypeName.trim();
    if (!name) return;

    try {
      await this.prayerTypeService.create({
        type: name,
        parent_type_id: null,
        sequence: 1,
      });
      this.newRootTypeName = '';
      await this.loadData();
    } catch (error) {
      console.error('Error creating root type:', error);
    }
  }

  /**
   * Called by child components when an update is made (edit/add/delete)
   * and they want the parent to reload the full tree.
   */
  async onRefreshNeeded() {
    await this.loadData();
  }
}
