import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface SegmentedOption<T = string> {
  value: T;
  label: string;
}

@Component({
  selector: 'app-segmented-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <div class="field-label"><span>{{ label() }}</span></div>
      <div class="segmented">
        @for (o of options(); track o.value) {
          <button type="button" [class.active]="o.value === value()" (click)="valueChange.emit(o.value)">
            {{ o.label }}
          </button>
        }
      </div>
    </div>
  `,
})
export class SegmentedControlComponent<T = string> {
  readonly label = input.required<string>();
  readonly value = input.required<T>();
  readonly options = input.required<SegmentedOption<T>[]>();
  readonly valueChange = output<T>();
}
