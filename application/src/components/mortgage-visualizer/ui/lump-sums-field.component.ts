import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { fmtDate, parseDate } from '../mortgage-calculator';
import { caretAfterDigits, cleanMoneyInput, digitsBefore, formatMoneyDraft, groupNumber } from '../format';
import { LumpSum, todayISO } from '../models';

@Component({
  selector: 'app-lump-sums-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <div class="field-label">
        <span>One-off lump sums</span>
        <span class="field-value">{{ lumps().length }} planned</span>
      </div>
      @if (lumps().length > 0) {
        <div class="lumps">
          @for (ls of lumps(); track $index) {
            <div class="lump-row">
              <div class="input-shell">
                <input type="date" [value]="ls.date" (change)="updateDate($index, $event)" />
              </div>
              <div class="input-shell">
                <span class="prefix">$</span>
                <input
                  type="text"
                  inputmode="decimal"
                  [value]="amountDisplay(ls.amount, $index)"
                  (input)="updateAmount($index, $event)"
                  (blur)="clearDraft($index)"
                />
              </div>
              <button type="button" class="lump-remove" aria-label="Remove" (click)="remove($index)">×</button>
            </div>
          }
        </div>
      }
      <button type="button" class="lump-add" (click)="add()">+ Add lump-sum payment</button>
    </div>
  `,
})
export class LumpSumsFieldComponent {
  readonly lumps = input.required<LumpSum[]>();
  readonly startDate = input.required<string>();
  readonly lumpsChange = output<LumpSum[]>();

  /** Per-row in-progress text, so a half-typed "1234." or "1234.5" survives
   *  Angular's re-render after each keystroke. Cleared on blur. */
  private readonly drafts = signal<Map<number, string>>(new Map());

  amountDisplay(amount: number, i: number): string {
    const d = this.drafts().get(i);
    if (d != null) { return d; }
    return groupNumber(amount);
  }

  clearDraft(i: number): void {
    const m = this.drafts();
    if (!m.has(i)) { return; }
    const next = new Map(m);
    next.delete(i);
    this.drafts.set(next);
  }

  add(): void {
    const current = this.lumps();
    const d = parseDate(this.startDate());
    d.setFullYear(d.getFullYear() + Math.max(1, current.length + 1));
    this.lumpsChange.emit([...current, { date: fmtDate(d), amount: 5000 }]);
  }

  updateDate(i: number, e: Event): void {
    const el = e.target as HTMLInputElement;
    if (!el.value) {
      // A lump-sum date can never be null — snap a cleared field back.
      el.value = this.lumps()[i]?.date || todayISO();
      return;
    }
    const next = this.lumps().slice();
    next[i] = { ...next[i], date: el.value };
    this.lumpsChange.emit(next);
  }

  updateAmount(i: number, e: Event): void {
    const el = e.target as HTMLInputElement;
    const before = digitsBefore(el.value, el.selectionStart ?? el.value.length);
    const cleaned = cleanMoneyInput(el.value);
    const formatted = formatMoneyDraft(cleaned);
    const caret = formatted === '' ? 0 : caretAfterDigits(formatted, before);
    el.value = formatted;
    el.setSelectionRange(caret, caret);
    const draftMap = new Map(this.drafts());
    draftMap.set(i, formatted);
    this.drafts.set(draftMap);

    const n = cleaned === '' ? 0 : (parseFloat(cleaned) || 0);
    const next = this.lumps().slice();
    next[i] = { ...next[i], amount: n };
    this.lumpsChange.emit(next);
  }

  remove(i: number): void {
    this.clearDraft(i);
    this.lumpsChange.emit(this.lumps().filter((_, j) => j !== i));
  }
}
