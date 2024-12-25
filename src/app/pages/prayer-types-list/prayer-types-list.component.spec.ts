import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrayerTypesListComponent } from './prayer-types-list.component';

describe('PrayerTypesListComponent', () => {
  let component: PrayerTypesListComponent;
  let fixture: ComponentFixture<PrayerTypesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrayerTypesListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrayerTypesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
