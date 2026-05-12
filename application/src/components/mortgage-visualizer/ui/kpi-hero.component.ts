import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MortgageResult } from '../mortgage-calculator';
import { duration, fullDate, groupNumber, money, moneyExact } from '../format';

@Component({
  selector: 'app-kpi-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!hasData()) {
      <div class="kpi-hero glass empty">
        <div class="cost-headline">
          <div class="cost-amount">Enter a price to begin</div>
          <div class="cost-headline-text">
            Add a purchase price and down payment — we&rsquo;ll show the full cost of borrowing,
            payoff date, and how extra payments change the timeline.
          </div>
        </div>
      </div>
    } @else {
      <div class="kpi-hero glass">
        <div class="cost-headline">
          <div class="cost-amount"><span class="currency">$</span>{{ totalInterestStr() }}</div>
          <div class="cost-headline-text">
            extra you'll pay in <span class="interest-word">interest</span> — that's
            <strong>{{ centsPerDollar() }}¢</strong> of <span class="interest-word">interest</span> for every dollar you borrow.
          </div>
        </div>
        <div class="kpi-row">
          <div class="kpi">
            <div class="kpi-label">Each payment</div>
            <div class="kpi-value">{{ eachPayment() }}</div>
            <div class="kpi-sub">{{ eachPaymentSub() }}</div>
          </div>
          <div class="kpi principal">
            <div class="kpi-label">Financed</div>
            <div class="kpi-value">{{ financed() }}</div>
            <div class="kpi-sub">after down payment</div>
          </div>
          <div class="kpi accent">
            <div class="kpi-label">Payoff date</div>
            <div class="kpi-value sm">{{ payoffDate() }}</div>
            <div class="kpi-sub">{{ payoffDuration() }} from start</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Time saved</div>
            <div class="kpi-value sm">{{ timeSaved() }}</div>
            <div class="kpi-sub positive">{{ timeSavedSub() }}</div>
          </div>
        </div>
      </div>
    }
  `,
})
export class KpiHeroComponent {
  readonly result = input.required<MortgageResult>();
  readonly baseline = input<MortgageResult | null>(null);

  readonly hasData = computed(() => {
    const r = this.result();
    return r.schedule.length > 0 && r.principal > 0;
  });

  readonly totalInterestStr = computed(() => groupNumber(Math.round(this.result().totalInterest)));

  readonly centsPerDollar = computed(() => {
    const r = this.result();
    const ratio = r.principal > 0 ? r.totalInterest / r.principal : 0;
    return (ratio * 100).toFixed(0);
  });

  private readonly firstExtra = computed(() => this.result().schedule[0]?.extraThisPayment ?? 0);

  readonly eachPayment = computed(() => moneyExact(this.result().basePayment + this.firstExtra()));

  readonly eachPaymentSub = computed(() =>
    this.firstExtra() > 0 ? `incl. ${money(this.firstExtra())} extra` : 'principal + interest');

  readonly financed = computed(() => money(this.result().principal));
  readonly payoffDate = computed(() => fullDate(this.result().payoffDateObj));

  private readonly daysToPayoff = computed(() => {
    const r = this.result();
    if (!r.schedule.length) { return 0; }
    return (r.payoffDateObj.getTime() - r.schedule[0].dateObj.getTime()) / 86_400_000;
  });

  readonly payoffDuration = computed(() => duration(this.daysToPayoff()));

  private readonly daysSaved = computed(() => {
    const b = this.baseline();
    if (!b || !b.schedule.length) { return 0; }
    const baseDays = (b.payoffDateObj.getTime() - b.schedule[0].dateObj.getTime()) / 86_400_000;
    return baseDays - this.daysToPayoff();
  });

  private readonly interestSaved = computed(() => {
    const b = this.baseline();
    return b ? b.totalInterest - this.result().totalInterest : 0;
  });

  readonly timeSaved = computed(() => this.daysSaved() > 30 ? duration(this.daysSaved()) : '—');
  readonly timeSavedSub = computed(() =>
    this.interestSaved() > 0 ? `saves ${money(this.interestSaved())} interest` : 'add extras to save');
}
