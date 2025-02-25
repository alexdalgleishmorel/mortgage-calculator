import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MortgageVisualizerComponent } from './mortgage-visualizer.component';

describe('MortgageVisualizerComponent', () => {
  let component: MortgageVisualizerComponent;
  let fixture: ComponentFixture<MortgageVisualizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MortgageVisualizerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MortgageVisualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
