import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Prayer } from '../../core/models/prayer.model';
import { PrayersService } from '../../core/services/prayers.service';
import { PrayerType } from '../../core/models/prayer-type.model';
import { PrayerTypeService } from '../../core/services/prayer-type.service';
import { PrayerSectionService } from '../../core/services/prayer-section.service';
import { Section } from '../../core/models/section.model';
import { SectionsService } from '../../core/services/sections.service';
import { PrayerSection } from '../../core/models/prayer-section.model';
import { PryaerDateGroupService } from '../../core/services/prayer-date-group.service';
import { DateGroupType } from '../../core/models/date-group-type.model';
import { DateGroup } from '../../core/models/date-group.model';
import { DateGroupService } from '../../core/services/date-group.service';
import { PrayerDateGroup } from '../../core/models/prayer-date-group.model';


@Component({
  standalone: true,
  selector: 'app-prayer-detail',
  imports: [CommonModule, FormsModule],
  templateUrl: './prayer-details.component.html',
  styleUrls: ['./prayer-details.component.css'],
})
export class PrayerDetailComponent implements OnInit {
  dateGroups: DateGroup[] = [];
  prayerTypes: PrayerType[] = [];
  sections: Section[] = [];
  prayer: Prayer | null = null;
  id!: string;

  newPrayerSection: PrayerSection | null = null;

  newPrayerDateGroup: PrayerDateGroup | null = null;

  constructor(
    private route: ActivatedRoute,
    private prayersService: PrayersService,
    private prayerTypesService: PrayerTypeService,
    private prayerSectionService: PrayerSectionService,
    private sectionsService: SectionsService,
    private prayerDateGroupService: PryaerDateGroupService,
    private dateGroupService: DateGroupService
  ) {}

  async ngOnInit(): Promise<void> {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.prayer = await this.prayersService.getParyerWithSectionsRecursively(this.id);
    this.newPrayerSection = {prayer_id: this.id, section_id: '', sequence: 1} as PrayerSection;
    this.newPrayerDateGroup = {prayer_id: this.id, date_group_id: 0, sequence: 1} as PrayerDateGroup;
    await this.getPrayerTypes();
    await this.getSections();
    await this.getDateGroups();
  }

  async getDateGroups() {
    this.dateGroups = await this.dateGroupService.getAll();
  }

  async getPrayerTypes() {
    this.prayerTypes = await this.prayerTypesService.getAll();
  }

  async getSections() {
    this.sections = await this.sectionsService.getAll();
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
    if (confirm('Ești sigur că vrei să ștergi această rugăciune?')) {
      try {
        await this.prayersService.delete(this.prayer.id);
        location.href = '/prayers';
      } catch (error) {
        alert('Eroare la ștergerea rugăciunii: ' + error);
      }
    }
  }

  async deleteSection(prayer_section_id: string, parent_id: string | null = null) {
    if (!this.prayer) return;
    if (confirm('Ești sigur că vrei să ștergi această secțiune?')) {
      try {
        await this.prayerSectionService.delete(prayer_section_id);

        if (parent_id) {
          const parentSection = this.prayer!.sections!.find((section) => section.id === parent_id);
          if (parentSection) {
            parentSection!.subsections = parentSection.subsections?.filter((section) => section.id !== prayer_section_id) ?? [];
        }} else {
        this.prayer!.sections! = this.prayer.sections?.filter((section) => section.id !== prayer_section_id) ?? [];
        }
      } catch (error) {
        alert('Eroare la ștergerea secțiunii: ' + error);
      }
  }}

  displayNewSubsectionForm(parentSectionId: string) {
    this.newPrayerSection!.parent_id = parentSectionId;
  }

  hideNewSubsectionForm() {
    this.newPrayerSection!.parent_id = null;
    this.newPrayerSection!.section_id = '';
  }

  addPrayerSection(parentSectionId: string | null = null) {
    if (!this.prayer) return;
    this.newPrayerSection = {...this.newPrayerSection, parent_id: parentSectionId, sequence: 1} as PrayerSection;
    this.prayerSectionService.create(this.newPrayerSection).then((result) => {
      this.newPrayerSection = {prayer_id: this.id, section_id: '', sequence: 1} as PrayerSection;
      if(parentSectionId) {
        const parentSection = this.prayer!.sections!.find((section) => section.id === parentSectionId);
        if(parentSection) {
          parentSection!.subsections!.push(result);
        }
      } else {
        this.prayer!.sections!.push(result);
      }
    }).catch((error) => {
      alert('Error creating subsection: ' + error);
    });
  }

  goBack() {
    window.history.back();
  }

  goToSection(id: string) {
    location.href = `/sections/${id}`;
  }

  deletePrayerDateGroup(dateGroupId: string) {
    if (!this.prayer) return;
    if (confirm('Ești sigur că vrei să ștergi această grupă de dată?')) {
      try {
        this.prayerDateGroupService.delete(dateGroupId);
        this.prayer.date_groups = this.prayer.date_groups?.filter((dateGroup) => dateGroup.id !== dateGroupId) ?? [];
      } catch (error) {
        alert('Eroare la ștergerea datei: ' + error);
      }
    }
  }

  addPrayerDateGroup() {
    if (!this.prayer) return;
    this.prayerDateGroupService.create(this.newPrayerDateGroup!).then((result) => {
      this.newPrayerDateGroup = {prayer_id: this.id, date_group_id: 0, sequence: 1} as PrayerDateGroup;
      this.prayer!.date_groups!.push(result);

    }).catch((error) => {
      alert('Error creating date group: ' + error);
    });
  }
}
