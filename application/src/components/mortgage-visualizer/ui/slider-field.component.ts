import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-slider-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field slider-field">
      <div class="field-label">
        <span>{{ label() }}</span>
        <span class="field-value-edit">
          <input
            class="field-value-input"
            type="text"
            inputmode="decimal"
            [value]="inputValue()"
            (focus)="onFocus($event)"
            (input)="onTypingInput($event)"
            (blur)="onBlur()"
            (keydown.enter)="commitBlur($event)"
          />
          @if (suffix()) {<span class="field-value-suffix">{{ suffix() }}</span>}
        </span>
      </div>
      <div class="slider-shell">
        <input
          #inp
          type="range"
          [min]="min()"
          [max]="max()"
          [step]="step()"
          [value]="value()"
          (input)="onSlider(+inp.value)"
        />
      </div>
    </div>
  `,
})
export class SliderFieldComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly step = input.required<number>();
  /** Optional unit (e.g. "%", " yr") appended after the editable number. */
  readonly suffix = input<string>('');
  readonly valueChange = output<number>();

  /** Holds raw user-typed text so a half-typed "5." doesn't get parsed and
   *  re-formatted until commit. Cleared on blur. */
  private readonly draft = signal<string | null>(null);

  /** Decimal places derived from step (0.01 → 2, 0.1 → 1, 1 → 0). */
  private readonly decimals = computed(() => {
    const s = this.step();
    if (s >= 1) { return 0; }
    return Math.max(0, Math.ceil(-Math.log10(s)));
  });

  readonly inputValue = computed(() => {
    const d = this.draft();
    return d != null ? d : this.value().toFixed(this.decimals());
  });

  onFocus(e: FocusEvent): void {
    (e.target as HTMLInputElement).select();
  }

  onTypingInput(e: Event): void {
    this.draft.set((e.target as HTMLInputElement).value);
  }

  onBlur(): void {
    const d = this.draft();
    if (d != null) { this.commit(d); }
    this.draft.set(null);
  }

  commitBlur(e: Event): void {
    (e.target as HTMLInputElement).blur();
  }

  onSlider(n: number): void {
    this.draft.set(null);
    this.valueChange.emit(n);
  }

  private commit(raw: string): void {
    const n = parseFloat(raw);
    if (isNaN(n)) { return; }
    const s = this.step();
    const snapped = Math.round(n / s) * s;
    const clamped = Math.max(this.min(), Math.min(this.max(), snapped));
    this.valueChange.emit(clamped);
  }
}
