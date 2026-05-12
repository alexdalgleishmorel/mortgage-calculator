import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-slider-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field slider-field">
      <div class="field-label">
        <span>{{ label() }}</span>
        <span class="field-value">{{ displayValue() }}</span>
      </div>
      <div class="slider-shell">
        <input
          #inp
          type="range"
          [min]="min()"
          [max]="max()"
          [step]="step()"
          [value]="value()"
          (input)="valueChange.emit(+inp.value)"
        />
      </div>
    </div>
  `,
})
export class SliderFieldComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly displayValue = input.required<string>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly step = input.required<number>();
  readonly valueChange = output<number>();
}
