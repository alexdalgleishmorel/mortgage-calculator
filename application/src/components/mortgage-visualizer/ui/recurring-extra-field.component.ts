import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { groupNumber, money } from '../format';
import { RecurringExtraMode } from '../models';

@Component({
  selector: 'app-recurring-extra-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <div class="field-label">
        <span>Recurring extra / payment</span>
        <span class="field-value">{{ secondaryLabel() }}</span>
      </div>
      <div class="input-with-toggle">
        <div class="input-shell">
          <span class="prefix">{{ mode() }}</span>
          <input
            #inp
            type="text"
            inputmode="decimal"
            placeholder="0"
            [value]="display()"
            (focus)="onFocus()"
            (blur)="onBlur()"
            (input)="onInput(inp.value)"
          />
        </div>
        <div class="mode-toggle">
          <button type="button" [class.active]="mode() === '$'" (click)="modeChange.emit('$')">$</button>
          <button type="button" [class.active]="mode() === '%'" (click)="modeChange.emit('%')">%</button>
        </div>
      </div>
    </div>
  `,
})
export class RecurringExtraFieldComponent {
  readonly recurringExtra = input.required<number>();   // dollars
  readonly mode = input.required<RecurringExtraMode>();
  readonly basePayment = input(0);

  readonly extraChange = output<number>();              // emits dollars
  readonly modeChange = output<RecurringExtraMode>();

  private readonly draft = signal<string | null>(null);

  /** The value shown in the input, in the units of the current mode. */
  private readonly displayVal = computed(() => {
    if (this.mode() === '%') {
      const bp = this.basePayment();
      return bp > 0 ? (this.recurringExtra() / bp * 100) : 0;
    }
    return this.recurringExtra();
  });

  readonly display = computed(() => {
    const d = this.draft();
    if (d != null) { return d; }
    const v = this.displayVal();
    if (v === 0) { return ''; }
    return this.mode() === '%' ? v.toFixed(1) : groupNumber(Math.round(v));
  });

  readonly secondaryLabel = computed(() => {
    const bp = this.basePayment();
    if (this.mode() === '%') {
      return `≈ ${money(this.recurringExtra())}/pmt`;
    }
    return bp > 0 ? `${(this.recurringExtra() / bp * 100).toFixed(1)}% of pmt` : '';
  });

  onFocus(): void {
    const v = this.displayVal();
    this.draft.set(v === 0 ? '' : String(this.mode() === '%' ? v.toFixed(1) : Math.round(v)));
  }

  onBlur(): void {
    this.draft.set(null);
  }

  onInput(raw: string): void {
    const cleaned = raw.replace(/[^\d.]/g, '');
    this.draft.set(cleaned);
    const n = cleaned === '' ? 0 : (parseFloat(cleaned) || 0);
    const dollars = this.mode() === '%'
      ? (this.basePayment() > 0 ? (n / 100) * this.basePayment() : 0)
      : n;
    this.extraChange.emit(Math.max(0, dollars));
  }
}
