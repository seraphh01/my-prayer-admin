import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiturgicalTextsListComponent } from './liturgical-texts-list.component';

describe('LiturgicalTextsListComponent', () => {
  let component: LiturgicalTextsListComponent;
  let fixture: ComponentFixture<LiturgicalTextsListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiturgicalTextsListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LiturgicalTextsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
