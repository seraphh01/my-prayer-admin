import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiturgicalTextDetailComponent } from './liturgical-text-detail.component';

describe('LiturgicalTextDetailComponent', () => {
  let component: LiturgicalTextDetailComponent;
  let fixture: ComponentFixture<LiturgicalTextDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiturgicalTextDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LiturgicalTextDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
