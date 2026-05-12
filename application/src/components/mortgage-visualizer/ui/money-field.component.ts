import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { groupNumber } from '../format';

@Component({
  selector: 'app-money-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <div class="field-label">
        <span>{{ label() }}</span>
        @if (secondary()) {<span class="field-value">{{ secondary() }}</span>}
      </div>
      <div class="input-shell">
        <span class="prefix">$</span>
        <input
          #inp
          type="text"
          inputmode="numeric"
          placeholder="0"
          [value]="display()"
          (focus)="onFocus()"
          (blur)="onBlur()"
          (input)="onInput(inp.value)"
        />
      </div>
    </div>
  `,
})
export class MoneyFieldComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly secondary = input<string | null>(null);
  readonly min = input(0);
  readonly max = input(100_000_000);
  readonly valueChange = output<number>();

  /** Local draft string so the field can be cleared without snapping back. */
  private readonly draft = signal<string | null>(null);

  readonly display = computed(() => {
    const d = this.draft();
    if (d != null) { return d; }
    const v = this.value();
    return v === 0 ? '' : groupNumber(v);
  });

  onFocus(): void {
    const v = this.value();
    this.draft.set(v === 0 ? '' : String(v));
  }

  onBlur(): void {
    this.draft.set(null);
  }

  onInput(raw: string): void {
    const cleaned = raw.replace(/[^\d.]/g, '');
    this.draft.set(cleaned);
    const n = cleaned === '' ? 0 : (parseFloat(cleaned) || 0);
    this.valueChange.emit(Math.max(this.min(), Math.min(this.max(), n)));
  }
}
