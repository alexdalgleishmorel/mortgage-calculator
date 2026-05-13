import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MoneyFieldComponent } from './money-field.component';
import { SliderFieldComponent } from './slider-field.component';
import { SegmentedControlComponent, SegmentedOption } from './segmented-control.component';
import { RecurringExtraFieldComponent } from './recurring-extra-field.component';
import { LumpSumsFieldComponent } from './lump-sums-field.component';
import { PaymentFrequency, Scenario, ScenarioColor, todayISO } from '../models';

const FREQUENCY_OPTIONS: SegmentedOption<PaymentFrequency>[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'bi-weekly', label: 'Bi-weekly' },
  { value: 'accelerated-bi-weekly', label: 'Accel. bi-wk' },
];

@Component({
  selector: 'app-scenario-inputs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MoneyFieldComponent,
    SliderFieldComponent,
    SegmentedControlComponent,
    RecurringExtraFieldComponent,
    LumpSumsFieldComponent,
  ],
  template: `
    @if (label()) {
      <div class="compare-col-label">
        <span class="scenario-dot" [style.background]="dotColor()" [style.color]="dotColor()"></span>
        {{ label() }}
      </div>
    }

    <app-money-field
      label="Purchase price"
      [value]="scenario().purchasePrice"
      (valueChange)="patch.emit({ purchasePrice: $event })"
    />

    <app-money-field
      label="Down payment"
      [value]="scenario().downPayment"
      [secondary]="downPctLabel()"
      [max]="scenario().purchasePrice"
      (valueChange)="patch.emit({ downPayment: $event })"
    />

    <app-slider-field
      label="Interest rate"
      [value]="scenario().interestRate"
      suffix="%"
      [min]="0.5" [max]="12" [step]="0.01"
      (valueChange)="patch.emit({ interestRate: $event })"
    />

    <app-slider-field
      label="Amortization"
      [value]="scenario().termYears"
      suffix=" yr"
      [min]="5" [max]="30" [step]="1"
      (valueChange)="patch.emit({ termYears: $event })"
    />

    <app-segmented-control
      label="Payment frequency"
      [value]="scenario().frequency"
      [options]="frequencyOptions"
      (valueChange)="patch.emit({ frequency: $event })"
    />

    <app-recurring-extra-field
      [recurringExtra]="scenario().recurringExtra"
      [mode]="scenario().recurringExtraMode"
      [basePayment]="basePayment()"
      (extraChange)="patch.emit({ recurringExtra: $event })"
      (modeChange)="patch.emit({ recurringExtraMode: $event })"
    />

    <app-lump-sums-field
      [lumps]="scenario().lumpSums"
      [startDate]="scenario().startDate"
      (lumpsChange)="patch.emit({ lumpSums: $event })"
    />

    @if (!compact()) {
      <div class="field">
        <div class="field-label"><span>Start date</span></div>
        <div class="input-shell">
          <input type="date" [value]="scenario().startDate" (change)="onStartDate($event)" />
        </div>
      </div>
    }
  `,
})
export class ScenarioInputsComponent {
  readonly scenario = input.required<Scenario>();
  readonly color = input<ScenarioColor>('a');
  readonly label = input<string | null>(null);
  readonly compact = input(false);
  readonly basePayment = input(0);

  readonly patch = output<Partial<Scenario>>();

  readonly frequencyOptions = FREQUENCY_OPTIONS;

  readonly dotColor = computed(() => `var(--scenario-${this.color()})`);
  readonly downPctLabel = computed(() => {
    const s = this.scenario();
    const pct = s.purchasePrice > 0 ? (s.downPayment / s.purchasePrice * 100) : 0;
    return `${pct.toFixed(1)}%`;
  });

  /** The start date can never be null: a cleared field snaps back to the
   *  current date (falling back to today if it were ever empty). */
  onStartDate(e: Event): void {
    const el = e.target as HTMLInputElement;
    if (!el.value) {
      el.value = this.scenario().startDate || todayISO();
      return;
    }
    this.patch.emit({ startDate: el.value });
  }
}
