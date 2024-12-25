import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrayersListComponent } from './prayers-list.component';

describe('PrayersListComponent', () => {
  let component: PrayersListComponent;
  let fixture: ComponentFixture<PrayersListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrayersListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrayersListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
