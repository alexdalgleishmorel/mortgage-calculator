import {
  ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { MortgageParams, calculateMortgage } from './mortgage-calculator';
import { DEFAULTS, DEFAULTS_B, Scenario, ScenarioMode } from './models';
import { groupNumber, money } from './format';

import { CollapsibleSectionComponent } from './ui/collapsible-section.component';
import { AreaChartComponent } from './ui/area-chart.component';
import { ScenarioToggleComponent } from './ui/scenario-toggle.component';
import { ScenarioInputsComponent } from './ui/scenario-inputs.component';
import { KpiHeroComponent } from './ui/kpi-hero.component';
import { CompareKpiCardComponent } from './ui/compare-kpi-card.component';
import { Theme, ThemeToggleComponent } from './ui/theme-toggle.component';

const THEME_KEY = 'mv-theme';
const STATE_KEY = 'mv-state-v1';

interface PersistedState {
  mode: ScenarioMode;
  scenA: Scenario;
  scenB: Scenario;
}

function toParams(s: Scenario): MortgageParams {
  return {
    purchasePrice: s.purchasePrice,
    downPayment: s.downPayment,
    interestRate: s.interestRate,
    termYears: s.termYears,
    frequency: s.frequency,
    recurringExtra: s.recurringExtra,
    lumpSums: s.lumpSums,
    startDate: s.startDate,
  };
}

@Component({
  selector: 'app-mortgage-visualizer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CollapsibleSectionComponent,
    AreaChartComponent,
    ScenarioToggleComponent,
    ScenarioInputsComponent,
    KpiHeroComponent,
    CompareKpiCardComponent,
    ThemeToggleComponent,
  ],
  template: `
    <div class="orbs">
      <div class="orb o1"></div>
      <div class="orb o2"></div>
      <div class="orb o3"></div>
    </div>

    <div class="app">
      <header class="header">
        <div class="brand">
          <div class="brand-mark">Mortgage <em>Visualizer</em></div>
          <div class="brand-tag">See what it really costs</div>
        </div>
        <div class="header-controls">
          <app-theme-toggle [theme]="theme()" (toggle)="toggleTheme()" />
          <app-scenario-toggle [mode]="mode()" (modeChange)="onModeChange($event)" />
        </div>
      </header>

      <div class="stack">
        <!-- SECTION 1 — cost of borrowing (TOP; hidden until data exists, collapsed by default) -->
        @if (summaryVisible()) {
          <app-collapsible-section
            [title]="single() ? 'Cost of borrowing' : 'Scenario showdown'"
            [subtitle]="single()
              ? 'Total interest, payoff date, and time you save with extras.'
              : 'Two scenarios, side by side — which one wins on total cost?'"
            accent="var(--interest)"
            [defaultOpen]="false"
          >
            <div section-header-extra class="section-headline">
              <span class="section-headline-amount">{{ summaryHeadline() }}</span>
              <span class="section-headline-label">
                @if (single()) { in <span class="interest-word">interest</span> } @else { over the loan }
              </span>
            </div>

            @if (single()) {
              <app-kpi-hero [result]="resultA()" [baseline]="baselineA()" />
            } @else {
              <app-compare-kpi-card [resultA]="resultA()" [resultB]="resultB()" />
            }

            @if (showInsuranceDisclaimer()) {
              <div class="insurance-disclaimer" role="note">
                <strong>Mortgage insurance applied.</strong>
                {{ insuranceDisclaimerText() }}
              </div>
            }
          </app-collapsible-section>
        }

        <!-- SECTION 2 — chart -->
        <app-collapsible-section
          [title]="single() ? 'Where your money goes' : 'Total cost over time'"
          [subtitle]="single()
            ? 'Stacked principal + interest paid, with remaining balance overlay. Hover to inspect any payment.'
            : 'Cumulative cost for each scenario. Hover to see the running difference.'"
          accent="var(--principal)"
        >
          <div section-header-extra class="legend">
            @if (single()) {
              <span class="legend-item" style="color: var(--principal)"><span class="legend-swatch"></span><span style="color: var(--fg-2)">Principal</span></span>
              <span class="legend-item" style="color: var(--interest)"><span class="legend-swatch"></span><span style="color: var(--fg-2)">Interest</span></span>
              <span class="legend-item" style="color: var(--remaining)"><span class="legend-line"></span><span style="color: var(--fg-2)">Remaining</span></span>
            } @else {
              <span class="legend-item" style="color: var(--scenario-a)"><span class="legend-line"></span><span style="color: var(--fg-2)">A</span></span>
              <span class="legend-item" style="color: var(--scenario-b)"><span class="legend-line dashed"></span><span style="color: var(--fg-2)">B</span></span>
            }
          </div>

          <app-area-chart
            [result]="resultA()"
            [resultB]="single() ? null : resultB()"
            [compareMode]="!single()"
            [lumpSums]="scenA().lumpSums"
            [lumpSumsB]="scenB().lumpSums"
            [downPayment]="scenA().downPayment"
            [downPaymentB]="scenB().downPayment"
            [axisScheduleA]="axisBaselineA().schedule"
            [axisScheduleB]="single() ? [] : axisBaselineB().schedule"
          />
        </app-collapsible-section>

        <!-- SECTION 3 — inputs -->
        <app-collapsible-section
          [title]="single() ? 'Your mortgage' : 'Scenarios A & B'"
          [subtitle]="single()
            ? 'Start with the purchase price — every other field has a sensible default you can fine-tune.'
            : 'Tune each column independently — start with the purchase price.'"
          accent="var(--scenario-a)"
        >
          <button section-header-extra type="button" class="reset-btn" (click)="reset()">↺ Reset</button>

          <details class="settings-disclaimer">
            <summary>About this calculator</summary>
            <div class="settings-disclaimer-body">
              <p>
                Math follows Canadian conventions. Monthly payments use semi-annual
                compounding as required by the Interest Act (s. 6); bi-weekly rates
                are derived from the same nominal rate, and accelerated bi-weekly
                pays the monthly amount ÷ 2 every 14 days.
              </p>
              <p>
                When the down payment is under 20%, <strong>CMHC mortgage default
                insurance</strong> is added to the loan and amortized with it.
                Premium rates: 2.80% (15–&lt;20% down), 3.10% (10–&lt;15%),
                4.00% (&lt;10%), plus a 0.20% surcharge for amortizations longer
                than 25 years.
              </p>
              <p>
                All amounts CAD. Actual qualification, premium tiers, and any
                provincial PST on the premium (ON, QC, SK) depend on your lender —
                this is an estimate.
              </p>
            </div>
          </details>

          @if (single()) {
            <div class="inputs-grid">
              <app-scenario-inputs
                [scenario]="scenA()"
                color="a"
                [basePayment]="resultA().basePayment || 0"
                (patch)="updateA($event)"
              />
            </div>
          } @else {
            <div class="compare-cols">
              <div class="compare-col">
                <app-scenario-inputs
                  [scenario]="scenA()"
                  color="a"
                  label="Scenario A"
                  [compact]="true"
                  [basePayment]="resultA().basePayment || 0"
                  (patch)="updateA($event)"
                />
              </div>
              <div class="compare-col">
                <app-scenario-inputs
                  [scenario]="scenB()"
                  color="b"
                  label="Scenario B"
                  [compact]="true"
                  [basePayment]="resultB().basePayment || 0"
                  (patch)="updateB($event)"
                />
              </div>
            </div>
          }
        </app-collapsible-section>

        <div class="footer-note">
          CAD · {{ single()
            ? 'Add a recurring extra or a one-off lump sum above to see how much sooner you’re free.'
            : 'Comparing two scenarios — change anything to see the trade-off.' }}
        </div>
      </div>
    </div>
  `,
})
export class MortgageVisualizerComponent {
  private readonly platformId = inject(PLATFORM_ID);

  readonly mode = signal<ScenarioMode>('single');
  readonly scenA = signal<Scenario>(DEFAULTS);
  readonly scenB = signal<Scenario>(DEFAULTS_B);
  readonly theme = signal<Theme>('dark');

  readonly single = computed(() => this.mode() === 'single');

  readonly resultA = computed(() => calculateMortgage(toParams(this.scenA())));
  readonly resultB = computed(() => calculateMortgage(toParams(this.scenB())));
  // Baseline for the "time/interest saved" KPI: strip extras AND the bi-weekly
  // acceleration (plain monthly amortization).
  readonly baselineA = computed(() => calculateMortgage({
    ...toParams(this.scenA()), recurringExtra: 0, lumpSums: [], frequency: 'monthly',
  }));
  // Baseline that fixes the chart's x-axis: the same scenario with the recurring
  // extra and lump sums removed (frequency kept), i.e. the full no-extras payoff.
  readonly axisBaselineA = computed(() => calculateMortgage({
    ...toParams(this.scenA()), recurringExtra: 0, lumpSums: [],
  }));
  readonly axisBaselineB = computed(() => calculateMortgage({
    ...toParams(this.scenB()), recurringExtra: 0, lumpSums: [],
  }));

  private readonly hasA = computed(() => this.resultA().schedule.length > 0 && this.resultA().principal > 0);
  private readonly hasB = computed(() => this.resultB().schedule.length > 0 && this.resultB().principal > 0);
  readonly summaryVisible = computed(() => this.single() ? this.hasA() : (this.hasA() && this.hasB()));

  readonly showInsuranceDisclaimer = computed(() => {
    if (this.single()) { return this.resultA().insurancePremium > 0; }
    return this.resultA().insurancePremium > 0 || this.resultB().insurancePremium > 0;
  });

  readonly insuranceDisclaimerText = computed(() => {
    const rateOf = (s: Scenario, premium: number): string => {
      const baseLoan = Math.max(0, s.purchasePrice - s.downPayment);
      return baseLoan > 0 ? (premium / baseLoan * 100).toFixed(2) + '%' : '—';
    };
    const a = this.resultA().insurancePremium;
    if (this.single()) {
      return `Down payment is under 20%, so a CMHC mortgage default insurance ` +
        `premium of ${money(a)} (${rateOf(this.scenA(), a)} of the base loan) ` +
        `has been rolled into the financed amount and amortized over the loan. ` +
        `Actual qualification, premium tiers, and any provincial PST on the ` +
        `premium (ON, QC, SK) depend on your lender — this is an estimate.`;
    }
    const b = this.resultB().insurancePremium;
    const parts: string[] = [];
    if (a > 0) { parts.push(`Scenario A: ${money(a)} (${rateOf(this.scenA(), a)})`); }
    if (b > 0) { parts.push(`Scenario B: ${money(b)} (${rateOf(this.scenB(), b)})`); }
    return `${parts.join(' · ')} of CMHC mortgage default insurance has been ` +
      `rolled into the loan because the down payment is under 20%. Actual rates ` +
      `and any provincial PST on the premium depend on your lender — this is an estimate.`;
  });

  readonly summaryHeadline = computed(() => {
    if (this.single()) {
      return '$' + groupNumber(Math.round(this.resultA().totalInterest));
    }
    const a = this.resultA().totalPaid; const b = this.resultB().totalPaid;
    const diff = Math.abs(a - b);
    if (diff <= 100) { return 'About even'; }
    const winner = a < b ? 'A' : 'B';
    return `${winner} saves $${groupNumber(Math.round(diff))}`;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark') { this.theme.set(saved); }
      } catch { /* ignore */ }

      try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistedState>;
          if (parsed.mode === 'single' || parsed.mode === 'compare') {
            this.mode.set(parsed.mode);
          }
          if (parsed.scenA) { this.scenA.set({ ...DEFAULTS, ...parsed.scenA }); }
          if (parsed.scenB) { this.scenB.set({ ...DEFAULTS_B, ...parsed.scenB }); }
        }
      } catch { /* ignore corrupt/quota state */ }
    }

    effect(() => {
      const t = this.theme();
      if (!isPlatformBrowser(this.platformId)) { return; }
      const base = t === 'light' ? '#ddcdb3' : '#14193a';
      document.body.classList.toggle('theme-light', t === 'light');
      document.body.classList.toggle('theme-dark', t !== 'light');
      document.documentElement.style.backgroundColor = base;
      document.body.style.backgroundColor = base;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', base);
      try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
    });

    effect(() => {
      const state: PersistedState = {
        mode: this.mode(),
        scenA: this.scenA(),
        scenB: this.scenB(),
      };
      if (!isPlatformBrowser(this.platformId)) { return; }
      try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* quota */ }
    });
  }

  updateA(patch: Partial<Scenario>): void {
    this.scenA.update(s => ({ ...s, ...patch }));
  }
  updateB(patch: Partial<Scenario>): void {
    this.scenB.update(s => ({ ...s, ...patch }));
  }

  /** Toggle single ⇄ compare. When entering compare mode from single, carry
   *  scenario A's loan context into B so both columns start with the user's
   *  current values (B keeps its own frequency / extras as the variation). */
  onModeChange(next: ScenarioMode): void {
    if (next === 'compare' && this.mode() === 'single') {
      const a = this.scenA();
      this.scenB.update(b => ({
        ...b,
        purchasePrice: a.purchasePrice,
        downPayment: a.downPayment,
        interestRate: a.interestRate,
        termYears: a.termYears,
        startDate: a.startDate,
      }));
    }
    this.mode.set(next);
  }

  toggleTheme(): void {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }

  reset(): void {
    this.scenA.set(DEFAULTS);
    this.scenB.set(DEFAULTS_B);
  }
}
