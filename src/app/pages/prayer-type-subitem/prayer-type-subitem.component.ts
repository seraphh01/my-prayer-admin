import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrayerTypeService } from '../../core/services/prayer-type.service';

@Component({
  standalone: true,
  selector: 'app-prayer-type-subitem',
  templateUrl: './prayer-type-subitem.component.html',
  styleUrls: ['./prayer-type-subitem.component.css'],
  imports: [CommonModule, FormsModule],
})
export class PrayerTypeSubitemComponent {
  @Input() node: any;          // The prayer type node, e.g. { id, type, subtypes: [...] }
  @Output() refreshNeeded = new EventEmitter<void>();

  // UI state for editing
  isEditing = false;
  tempName = '';

  constructor(private prayerTypeService: PrayerTypeService) {}

  enableEdit() {
    this.isEditing = true;
    this.tempName = this.node.type; // Initialize with current name
  }

  cancelEdit() {
    this.isEditing = false;
    this.tempName = '';
  }

  async saveEdit() {
    const newName = this.tempName.trim();
    if (!newName) {
      alert('Name cannot be empty');
      return;
    }

    try {
      await this.prayerTypeService.update(this.node.id, {
        type: newName,
      });
      // Locally update the displayed name
      this.node.type = newName;
      this.isEditing = false;
      this.refreshNeeded.emit(); // Let parent know we changed data
    } catch (error) {
      console.error('Error updating prayer type:', error);
    }
  }

  async addSubtype() {
    const subtypeName = prompt('Enter subtype name:');
    if (!subtypeName) return;

    try {
      await this.prayerTypeService.create({
        type: subtypeName,
        parent_type_id: this.node.id,
        sequence: 1,
      });
      this.refreshNeeded.emit();
    } catch (error) {
      console.error('Error creating subtype:', error);
    }
  }

  async deleteType() {
    if (!confirm(`Are you sure you want to delete "${this.node.type}"?`)) return;

    try {
      await this.prayerTypeService.delete(this.node.id);
      this.refreshNeeded.emit();
    } catch (error) {
      console.error('Error deleting prayer type:', error);
    }
  }

  /**
   * When a child subitem refreshes, bubble up the event so the parent can reload if needed.
   */
  onChildRefreshNeeded() {
    this.refreshNeeded.emit();
  }
}
