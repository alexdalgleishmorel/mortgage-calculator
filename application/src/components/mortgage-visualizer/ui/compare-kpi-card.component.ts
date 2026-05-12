import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MortgageResult } from '../mortgage-calculator';
import { duration, money, monthName } from '../format';

@Component({
  selector: 'app-compare-kpi-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!hasBoth()) {
      <div class="kpi-hero glass empty">
        <div class="cost-headline">
          <div class="cost-amount">Fill in both scenarios</div>
          <div class="cost-headline-text">Enter a purchase price for each scenario to see the comparison.</div>
        </div>
      </div>
    } @else {
      <div class="compare-kpi-card glass">
        <div class="compare-kpi-col">
          <div class="compare-kpi-name">
            <span class="scenario-dot" style="background: var(--scenario-a); color: var(--scenario-a)"></span>
            Scenario A
          </div>
          <div class="compare-kpi-big" style="color: var(--scenario-a)">{{ interestA() }}</div>
          <div class="compare-kpi-line">interest · {{ durationA() }} · paid off {{ payoffA() }}</div>
        </div>
        <div class="compare-divider"></div>
        <div class="compare-kpi-col b">
          <div class="compare-kpi-name">
            <span class="scenario-dot" style="background: var(--scenario-b); color: var(--scenario-b)"></span>
            Scenario B
          </div>
          <div class="compare-kpi-big" style="color: var(--scenario-b)">{{ interestB() }}</div>
          <div class="compare-kpi-line">interest · {{ durationB() }} · paid off {{ payoffB() }}</div>
        </div>
        <div class="compare-savings">
          @if (savings() > 100) {
            Scenario <strong>{{ winner() }}</strong> saves <strong>{{ savingsStr() }}</strong> in total cost{{ savingsTail() }}
          } @else {
            Both scenarios cost about the same — adjust the inputs to compare.
          }
        </div>
      </div>
    }
  `,
})
export class CompareKpiCardComponent {
  readonly resultA = input.required<MortgageResult>();
  readonly resultB = input.required<MortgageResult>();

  readonly hasBoth = computed(() => this.resultA().schedule.length > 0 && this.resultB().schedule.length > 0);

  readonly interestA = computed(() => money(this.resultA().totalInterest, { compact: true }));
  readonly interestB = computed(() => money(this.resultB().totalInterest, { compact: true }));

  private readonly daysA = computed(() => this.payoffDays(this.resultA()));
  private readonly daysB = computed(() => this.payoffDays(this.resultB()));

  readonly durationA = computed(() => duration(this.daysA()));
  readonly durationB = computed(() => duration(this.daysB()));
  readonly payoffA = computed(() => monthName(this.resultA().payoffDateObj));
  readonly payoffB = computed(() => monthName(this.resultB().payoffDateObj));

  private readonly diff = computed(() => this.resultA().totalPaid - this.resultB().totalPaid);
  readonly winner = computed(() => this.diff() > 0 ? 'B' : 'A');
  readonly savings = computed(() => Math.abs(this.diff()));
  readonly savingsStr = computed(() => money(this.savings()));

  readonly savingsTail = computed(() =>
    Math.abs(this.daysA() - this.daysB()) > 30
      ? ` and ${duration(Math.abs(this.daysA() - this.daysB()))} off the timeline.`
      : '.');

  private payoffDays(r: MortgageResult): number {
    if (!r.schedule.length) { return 0; }
    return (r.payoffDateObj.getTime() - r.schedule[0].dateObj.getTime()) / 86_400_000;
  }
}
