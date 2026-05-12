import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { caretAfterDigits, cleanMoneyInput, digitsBefore, formatMoneyDraft, groupNumber } from '../format';

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
          type="text"
          inputmode="numeric"
          placeholder="0"
          [value]="display()"
          (focus)="onFocus()"
          (blur)="onBlur()"
          (input)="onInput($event)"
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

  /** Holds what the user is typing (already grouped), so the field can hold a
   *  half-typed value that differs from the clamped/normalized number. */
  private readonly draft = signal<string | null>(null);

  readonly display = computed(() => {
    const d = this.draft();
    if (d != null) { return d; }
    const v = this.value();
    return v === 0 ? '' : groupNumber(v);
  });

  onFocus(): void { /* keep the formatted value; live-format takes over on input */ }

  onBlur(): void { this.draft.set(null); }

  onInput(e: Event): void {
    const el = e.target as HTMLInputElement;
    const before = digitsBefore(el.value, el.selectionStart ?? el.value.length);
    const cleaned = cleanMoneyInput(el.value);
    const formatted = formatMoneyDraft(cleaned);
    const caret = formatted === '' ? 0 : caretAfterDigits(formatted, before);

    // Write the grouped value back immediately so the caret survives the
    // change-detection re-render (which sets the same string → no caret jump).
    el.value = formatted;
    el.setSelectionRange(caret, caret);
    this.draft.set(formatted);

    const n = cleaned === '' ? 0 : (parseFloat(cleaned) || 0);
    this.valueChange.emit(Math.max(this.min(), Math.min(this.max(), n)));
  }
}
