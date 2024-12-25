import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrayerTypeSubitemComponent } from './prayer-type-subitem.component';

describe('PrayerTypeSubitemComponent', () => {
  let component: PrayerTypeSubitemComponent;
  let fixture: ComponentFixture<PrayerTypeSubitemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrayerTypeSubitemComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrayerTypeSubitemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
