import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { fmtDate, parseDate } from '../mortgage-calculator';
import { groupNumber } from '../format';
import { LumpSum } from '../models';

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
                <input type="date" [value]="ls.date" (change)="updateDate($index, dateInput.value)" #dateInput />
              </div>
              <div class="input-shell">
                <span class="prefix">$</span>
                <input
                  type="text"
                  inputmode="numeric"
                  [value]="amountDisplay(ls.amount)"
                  (input)="updateAmount($index, amtInput.value)"
                  #amtInput
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

  amountDisplay(amount: number): string {
    return groupNumber(amount);
  }

  add(): void {
    const current = this.lumps();
    const d = parseDate(this.startDate());
    d.setFullYear(d.getFullYear() + Math.max(1, current.length + 1));
    this.lumpsChange.emit([...current, { date: fmtDate(d), amount: 5000 }]);
  }

  updateDate(i: number, value: string): void {
    const next = this.lumps().slice();
    next[i] = { ...next[i], date: value };
    this.lumpsChange.emit(next);
  }

  updateAmount(i: number, raw: string): void {
    const cleaned = raw.replace(/[^\d.]/g, '');
    const next = this.lumps().slice();
    next[i] = { ...next[i], amount: parseFloat(cleaned) || 0 };
    this.lumpsChange.emit(next);
  }

  remove(i: number): void {
    this.lumpsChange.emit(this.lumps().filter((_, j) => j !== i));
  }
}
