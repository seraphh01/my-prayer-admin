import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DateGroup } from '../../core/models/date-group.model';
import { DateGroupType } from '../../core/models/date-group-type.model';
import { DateGroupService } from '../../core/services/date-group.service';

@Component({
  standalone: true,
  selector: 'app-prayer-date-groups',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './prayer-date-groups.component.html',
  styleUrls: ['./prayer-date-groups.component.css'],
})
export class PrayerDateGroupsComponent implements OnInit {
  dateGroups: DateGroup[] = [];
  dateGroupTypes: DateGroupType[] = [];
  readonly weekdayOptions = [
    { value: 1, label: 'Luni' },
    { value: 2, label: 'Marti' },
    { value: 3, label: 'Miercuri' },
    { value: 4, label: 'Joi' },
    { value: 5, label: 'Vineri' },
    { value: 6, label: 'Sambata' },
    { value: 7, label: 'Duminica' },
  ];

  loading = false;
  saving = false;
  errorMessage = '';
  usageLoadingByGroupId: Record<number, boolean> = {};
  expandedUsageByGroupId: Record<number, boolean> = {};
  usageByGroupId: Record<number, Array<{ id: string; title: string; subtitle: string | null }>> = {};

  editingId: number | null = null;
  editDraft: Partial<DateGroup> = {};
  editTime = '';
  editingTypeId: number | null = null;
  editTypeName = '';
  newTypeName = '';
  newTime = '';

  newGroup: Partial<DateGroup> = {
    title: '',
    specific_date: null,
    day_of_week: null,
    month: null,
    day: null,
    hour: null,
    date_group_type_id: null,
  };

  constructor(private dateGroupService: DateGroupService) {}

  async ngOnInit(): Promise<void> {
    await this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    try {
      const [groups, types] = await Promise.all([this.dateGroupService.getAll(), this.fetchDateGroupTypes()]);
      this.dateGroups = groups;
      this.dateGroupTypes = types;
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Nu s-au putut încărca grupele de dată.';
    } finally {
      this.loading = false;
    }
  }

  startEditType(type: DateGroupType): void {
    this.editingTypeId = type.id;
    this.editTypeName = type.name;
  }

  cancelEditType(): void {
    this.editingTypeId = null;
    this.editTypeName = '';
  }

  async saveEditType(type: DateGroupType): Promise<void> {
    if (this.editingTypeId !== type.id) return;
    const name = this.editTypeName.trim();
    if (!name) {
      this.errorMessage = 'Numele tipului este obligatoriu.';
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    try {
      const { error } = await this.dateGroupService.client
        .from('date_group_type')
        .update({ name })
        .eq('id', type.id);
      if (error) throw error;
      this.cancelEditType();
      await this.loadAll();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Nu s-a putut salva tipul.';
    } finally {
      this.saving = false;
    }
  }

  async createType(): Promise<void> {
    const name = this.newTypeName.trim();
    if (!name) {
      this.errorMessage = 'Numele tipului este obligatoriu.';
      return;
    }
    this.saving = true;
    this.errorMessage = '';
    try {
      const { error } = await this.dateGroupService.client.from('date_group_type').insert([{ name }]);
      if (error) throw error;
      this.newTypeName = '';
      await this.loadAll();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Nu s-a putut crea tipul.';
    } finally {
      this.saving = false;
    }
  }

  async deleteType(type: DateGroupType): Promise<void> {
    if (!confirm(`Ștergi tipul „${type.name}”?`)) return;
    this.saving = true;
    this.errorMessage = '';
    try {
      const { error } = await this.dateGroupService.client.from('date_group_type').delete().eq('id', type.id);
      if (error) throw error;
      await this.loadAll();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Nu s-a putut șterge tipul.';
    } finally {
      this.saving = false;
    }
  }

  startEdit(group: DateGroup): void {
    this.editingId = group.id;
    this.editDraft = {
      title: group.title,
      specific_date: group.specific_date,
      day_of_week: group.day_of_week,
      month: group.month,
      day: group.day,
      hour: group.hour,
      date_group_type_id: group.date_group_type_id,
    };
    this.editTime = this.hourToTime(group.hour);
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editDraft = {};
    this.editTime = '';
  }

  async saveEdit(group: DateGroup): Promise<void> {
    if (this.editingId !== group.id) return;
    this.saving = true;
    this.errorMessage = '';
    try {
      this.editDraft.hour = this.timeToHour(this.editTime);
      await this.dateGroupService.update(group.id, this.cleanPayload(this.editDraft));
      this.cancelEdit();
      await this.loadAll();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Nu s-a putut salva grupa de dată.';
    } finally {
      this.saving = false;
    }
  }

  async createGroup(): Promise<void> {
    this.saving = true;
    this.errorMessage = '';
    try {
      this.newGroup.hour = this.timeToHour(this.newTime);
      await this.dateGroupService.create(this.cleanPayload(this.newGroup));
      this.newGroup = {
        title: '',
        specific_date: null,
        day_of_week: null,
        month: null,
        day: null,
        hour: null,
        date_group_type_id: null,
      };
      this.newTime = '';
      await this.loadAll();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Nu s-a putut crea grupa de dată.';
    } finally {
      this.saving = false;
    }
  }

  async deleteGroup(group: DateGroup): Promise<void> {
    if (!confirm(`Ștergi grupa de dată „${group.title ?? '(fără titlu)'}”?`)) return;
    this.saving = true;
    this.errorMessage = '';
    try {
      await this.dateGroupService.delete(group.id);
      await this.loadAll();
    } catch (err) {
      this.errorMessage = err instanceof Error ? err.message : 'Nu s-a putut șterge grupa de dată.';
    } finally {
      this.saving = false;
    }
  }

  async toggleGroupUsage(group: DateGroup): Promise<void> {
    const groupId = group.id;
    const alreadyExpanded = this.expandedUsageByGroupId[groupId];
    if (alreadyExpanded) {
      this.expandedUsageByGroupId[groupId] = false;
      return;
    }

    if (!this.usageByGroupId[groupId]) {
      this.usageLoadingByGroupId[groupId] = true;
      try {
        const { data, error } = await this.dateGroupService.client
          .from('prayer_date_group')
          .select('prayer:prayers(id, title, subtitle)')
          .eq('date_group_id', groupId)
          .order('sequence', { ascending: true });
        if (error) throw error;

        this.usageByGroupId[groupId] = (data ?? [])
          .map((row) => {
            const prayerRaw = (row as { prayer?: unknown }).prayer;
            if (Array.isArray(prayerRaw)) {
              const first = prayerRaw[0] as
                | { id?: string; title?: string; subtitle?: string | null }
                | undefined;
              if (!first?.id || !first?.title) return null;
              return { id: first.id, title: first.title, subtitle: first.subtitle ?? null };
            }
            const prayerObj = prayerRaw as { id?: string; title?: string; subtitle?: string | null } | null;
            if (!prayerObj?.id || !prayerObj?.title) return null;
            return { id: prayerObj.id, title: prayerObj.title, subtitle: prayerObj.subtitle ?? null };
          })
          .filter((p): p is { id: string; title: string; subtitle: string | null } => Boolean(p));
      } catch (err) {
        this.errorMessage = err instanceof Error ? err.message : 'Nu s-au putut încărca rugăciunile.';
        this.usageByGroupId[groupId] = [];
      } finally {
        this.usageLoadingByGroupId[groupId] = false;
      }
    }

    this.expandedUsageByGroupId[groupId] = true;
  }

  private async fetchDateGroupTypes(): Promise<DateGroupType[]> {
    const { data, error } = await this.dateGroupService.client
      .from('date_group_type')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as DateGroupType[];
  }

  private cleanPayload(payload: Partial<DateGroup>): Partial<DateGroup> {
    return {
      title: payload.title?.trim() || null,
      specific_date: payload.specific_date || null,
      day_of_week: this.toNumberOrNull(payload.day_of_week),
      month: this.toNumberOrNull(payload.month),
      day: this.toNumberOrNull(payload.day),
      hour: this.toNumberOrNull(payload.hour),
      date_group_type_id: this.toNumberOrNull(payload.date_group_type_id),
    };
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }

  dayOfWeekLabel(day: number | null): string {
    if (day === null || day === undefined) return '-';
    return this.weekdayOptions.find((d) => d.value === day)?.label ?? String(day);
  }

  hourToTime(hour: number | null): string {
    if (hour === null || hour === undefined) return '';
    const h = Math.max(0, Math.min(23, hour));
    return `${String(h).padStart(2, '0')}:00`;
  }

  timeToHour(time: string): number | null {
    if (!time) return null;
    const [hh] = time.split(':');
    const h = Number(hh);
    if (Number.isNaN(h)) return null;
    return Math.max(0, Math.min(23, h));
  }
}
