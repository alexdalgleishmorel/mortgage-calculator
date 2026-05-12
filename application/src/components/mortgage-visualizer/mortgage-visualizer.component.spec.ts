import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MortgageVisualizerComponent } from './mortgage-visualizer.component';

describe('MortgageVisualizerComponent', () => {
  let component: MortgageVisualizerComponent;
  let fixture: ComponentFixture<MortgageVisualizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MortgageVisualizerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MortgageVisualizerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates and renders the header brand', () => {
    expect(component).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand-mark')?.textContent).toContain('Mortgage');
  });

  it('hides the cost-of-borrowing section until a price is entered', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-kpi-hero')).toBeNull();
    expect(component.summaryVisible()).toBeFalse();
  });

  it('reveals the summary section once scenario A has a financed amount', () => {
    component.updateA({ purchasePrice: 600_000, downPayment: 100_000 });
    fixture.detectChanges();
    expect(component.summaryVisible()).toBeTrue();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-kpi-hero')).not.toBeNull();
  });

  it('switches to compare mode', () => {
    component.mode.set('compare');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.compare-cols')).not.toBeNull();
  });

  it('reset restores the default scenarios', () => {
    component.updateA({ purchasePrice: 999_000 });
    component.reset();
    expect(component.scenA().purchasePrice).toBe(0);
    expect(component.scenB().recurringExtra).toBe(200);
  });
});
