import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrayerDetailsComponent } from './prayer-details.component';

describe('PrayerDetailsComponent', () => {
  let component: PrayerDetailsComponent;
  let fixture: ComponentFixture<PrayerDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrayerDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrayerDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
