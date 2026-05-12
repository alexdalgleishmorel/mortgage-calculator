import {
  ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, signal, viewChild,
} from '@angular/core';
import { MortgageResult, PaymentDetail } from '../mortgage-calculator';
import { LumpSum } from '../models';
import { compactMoney, money, moneyExact, niceStep } from '../format';

interface Hover { x: number; idx: number; }
interface LumpMarker { idx: number; amount: number; date: string; }
interface PayoffMarker { x: number; labelX: number; anchor: 'start' | 'end'; color: string; label: string; }

const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

@Component({
  selector: 'app-area-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!hasData()) {
      <div class="chart-wrap empty-chart" #wrap>
        <div class="empty-illustration">
          <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden="true">
            <path d="M8 70 L8 12 M8 70 L112 70" stroke="currentColor" stroke-opacity=".25" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M14 60 Q40 56 56 44 T108 16" stroke="var(--remaining)" stroke-opacity=".55" stroke-width="1.6" stroke-dasharray="4 4" fill="none" stroke-linecap="round"/>
            <path d="M14 66 Q40 60 56 48 T108 22 L108 70 L14 70 Z" fill="var(--principal)" fill-opacity=".18"/>
            <path d="M14 68 Q40 64 56 56 T108 38 L108 70 L14 70 Z" fill="var(--interest)" fill-opacity=".22"/>
          </svg>
        </div>
        <div class="empty-title">Your chart appears here</div>
        <div class="empty-sub">Enter a <strong>purchase price</strong> in the configuration below to see where your payments go over time.</div>
      </div>
    } @else {
      <div class="chart-wrap" #wrap>
        <svg
          class="chart-svg"
          [attr.viewBox]="'0 0 ' + W() + ' ' + H()"
          preserveAspectRatio="none"
          (mousemove)="onMouseMove($event)"
          (mouseleave)="hover.set(null)"
          (touchstart)="onTouch($event)"
          (touchmove)="onTouch($event)"
        >
          <defs>
            <linearGradient id="grad-principal" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="var(--principal)" stop-opacity="0.55" />
              <stop offset="100%" stop-color="var(--principal)" stop-opacity="0.10" />
            </linearGradient>
            <linearGradient id="grad-interest" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="var(--interest)" stop-opacity="0.45" />
              <stop offset="100%" stop-color="var(--interest)" stop-opacity="0.08" />
            </linearGradient>
          </defs>

          <!-- Grid + y-axis labels -->
          @for (t of yTicks(); track t.v) {
            <line class="grid-line" [attr.x1]="PAD.left" [attr.x2]="W() - PAD.right" [attr.y1]="t.y" [attr.y2]="t.y" />
            <text class="axis-label" [attr.x]="PAD.left - 8" [attr.y]="t.y" text-anchor="end" dominant-baseline="central">{{ t.label }}</text>
          }

          <!-- X-axis labels -->
          @for (t of xTicks(); track t.i) {
            <text class="axis-label" [attr.x]="t.x" [attr.y]="H() - PAD.bottom + 16" text-anchor="middle">{{ t.label }}</text>
          }

          <!-- Series -->
          @if (!compareMode()) {
            <path class="area-interest" [attr.d]="seriesA().interestArea" />
            <path class="area-principal" [attr.d]="seriesA().principalArea" />
            <path class="line-remaining" [attr.d]="seriesA().remainingLine" />
          } @else {
            <path class="scen-area-a" [attr.d]="totalA().area" />
            <path class="scen-area-b" [attr.d]="totalB().area" />
            <path class="scen-line-a" [attr.d]="totalA().line" />
            <path class="scen-line-b" [attr.d]="totalB().line" />
          }

          <!-- Lump-sum markers -->
          @for (m of lumpMarkers(); track $index) {
            <line class="lump-grid-line" [attr.x1]="xScale(m.idx)" [attr.x2]="xScale(m.idx)" [attr.y1]="PAD.top" [attr.y2]="H() - PAD.bottom" />
            <circle class="lump-marker" [attr.cx]="xScale(m.idx)" [attr.cy]="PAD.top + 8" r="5" />
          }

          <!-- Payoff markers: where the loan actually clears, vs the full no-extra term -->
          @for (pm of payoffMarkers(); track pm.color) {
            <line class="payoff-line" [attr.x1]="pm.x" [attr.x2]="pm.x" [attr.y1]="PAD.top" [attr.y2]="H() - PAD.bottom" [attr.stroke]="pm.color" />
            <circle class="payoff-dot" [attr.cx]="pm.x" [attr.cy]="H() - PAD.bottom" r="3.5" [attr.fill]="pm.color" />
            <text class="payoff-tag" [attr.x]="pm.labelX" [attr.y]="PAD.top + 11" [attr.text-anchor]="pm.anchor" [attr.fill]="pm.color">PAID OFF</text>
            <text class="payoff-when" [attr.x]="pm.labelX" [attr.y]="PAD.top + 23" [attr.text-anchor]="pm.anchor">{{ pm.label }}</text>
          }

          <!-- Hover -->
          @if (hover(); as h) {
            <line class="cursor-line" [attr.x1]="h.x" [attr.x2]="h.x" [attr.y1]="PAD.top" [attr.y2]="H() - PAD.bottom" />
            @if (!compareMode() && hoverA(); as p) {
              <circle class="cursor-dot" [attr.cx]="h.x" [attr.cy]="yScale(p.remaining)" r="5" />
            }
            @if (compareMode() && hoverA(); as p) {
              <circle [attr.cx]="h.x" [attr.cy]="yScale(p.cumPrincipal + p.cumInterest)" r="4" fill="var(--scenario-a)" stroke="white" stroke-width="1.5" />
            }
            @if (compareMode() && hoverB(); as p) {
              <circle [attr.cx]="h.x" [attr.cy]="yScale(p.cumPrincipal + p.cumInterest)" r="4" fill="var(--scenario-b)" stroke="white" stroke-width="1.5" />
            }
          }
        </svg>

        @if (hover() && (hoverA() || hoverB())) {
          <div class="chart-tooltip" [style.left.%]="tooltipLeftPct()" style="top: 50%" [style.transform]="tooltipTransform()">
            <div class="tooltip-date">{{ tooltipDate() }}</div>
            @if (!compareMode() && hoverA(); as p) {
              <div class="tooltip-row">
                <span><span class="tooltip-swatch" style="background: var(--principal)"></span>Principal paid</span>
                <span>{{ exact(p.principalPaid) }}</span>
              </div>
              <div class="tooltip-row">
                <span><span class="tooltip-swatch" style="background: var(--interest)"></span>Interest paid</span>
                <span>{{ exact(p.interestPaid) }}</span>
              </div>
              <div class="tooltip-row section emph">
                <span>Payment</span>
                <span>{{ exact(p.totalPayment) }}</span>
              </div>
              <div class="tooltip-row section">
                <span>Total equity</span>
                <span>{{ m(p.cumPrincipal) }}</span>
              </div>
              <div class="tooltip-row">
                <span>Total remaining</span>
                <span>{{ m(p.remaining) }}</span>
              </div>
              @if (p.extraThisPayment > 0) {
                <div class="tooltip-row section extra">
                  <span>+ Extra</span>
                  <span>{{ m(p.extraThisPayment) }}</span>
                </div>
              }
            }
            @if (compareMode()) {
              @if (hoverA(); as p) {
                <div class="tooltip-row">
                  <span><span class="tooltip-swatch" style="background: var(--scenario-a)"></span>Scenario A total</span>
                  <span>{{ m(p.cumPrincipal + p.cumInterest) }}</span>
                </div>
              }
              @if (hoverB(); as p) {
                <div class="tooltip-row">
                  <span><span class="tooltip-swatch" style="background: var(--scenario-b)"></span>Scenario B total</span>
                  <span>{{ m(p.cumPrincipal + p.cumInterest) }}</span>
                </div>
              }
              @if (hoverA() && hoverB()) {
                <div class="tooltip-row divider">
                  <span>Difference</span>
                  <span>{{ m(diffAtHover()) }}</span>
                </div>
              }
            }
          </div>
        }
      </div>
    }
  `,
})
export class AreaChartComponent {
  readonly result = input.required<MortgageResult>();
  readonly resultB = input<MortgageResult | null>(null);
  readonly compareMode = input(false);
  readonly lumpSums = input<LumpSum[]>([]);
  readonly lumpSumsB = input<LumpSum[]>([]);
  /** Schedules of the same scenarios with no extra payments — fix the x-axis to
   *  the full "no-extras" payoff time so early payoff shows as empty runway. */
  readonly axisScheduleA = input<PaymentDetail[]>([]);
  readonly axisScheduleB = input<PaymentDetail[]>([]);

  protected readonly PAD = PAD;

  private readonly wrapEl = viewChild<ElementRef<HTMLDivElement>>('wrap');
  private readonly size = signal<{ w: number; h: number }>({ w: 800, h: 380 });
  readonly hover = signal<Hover | null>(null);

  constructor() {
    // Track the wrapper element with a ResizeObserver. Re-runs (and tears down the
    // old observer) whenever the wrapper is recreated — e.g. empty ⇄ populated.
    effect((onCleanup) => {
      const el = this.wrapEl()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') { return; }
      const ro = new ResizeObserver((entries) => {
        const r = entries[0].contentRect;
        this.size.set({ w: Math.max(320, r.width), h: Math.max(220, r.height) });
      });
      ro.observe(el);
      onCleanup(() => ro.disconnect());
    });
  }

  // ── geometry ────────────────────────────────────────────────────────────
  readonly W = computed(() => this.size().w);
  readonly H = computed(() => this.size().h);
  private readonly innerW = computed(() => this.W() - PAD.left - PAD.right);
  private readonly innerH = computed(() => this.H() - PAD.top - PAD.bottom);

  private readonly schedA = computed<PaymentDetail[]>(() => this.result().schedule ?? []);
  private readonly schedB = computed<PaymentDetail[]>(() => this.resultB()?.schedule ?? []);

  /** Extent of the actual data (used for hover clamping). */
  private readonly dataLen = computed(() => Math.max(this.schedA().length, this.schedB().length));

  /** Schedule that defines the x-axis span (the longer no-extras baseline), with
   *  a fallback to the actual data when no baseline schedules are supplied. */
  private readonly axisRef = computed<PaymentDetail[]>(() => {
    const a = this.axisScheduleA(); const b = this.axisScheduleB();
    const longestBaseline = a.length >= b.length ? a : b;
    if (longestBaseline.length) { return longestBaseline; }
    return this.schedA().length >= this.schedB().length ? this.schedA() : this.schedB();
  });
  /** Number of x positions on the axis. */
  private readonly axisLen = computed(() => Math.max(
    this.axisRef().length, this.schedA().length, this.schedB().length, 1));

  readonly hasData = computed(() => this.schedA().length > 0 || this.schedB().length > 0);

  private readonly yMax = computed(() => {
    const a = this.schedA(); const b = this.schedB();
    const ca = a.length ? Math.max(a[a.length - 1].cumPrincipal + a[a.length - 1].cumInterest, a[0].remaining) : 0;
    const cb = b.length ? Math.max(b[b.length - 1].cumPrincipal + b[b.length - 1].cumInterest, b[0].remaining) : 0;
    return Math.max(ca, cb) * 1.05 || 1;
  });

  xScale = (i: number): number => PAD.left + (i / Math.max(1, this.axisLen() - 1)) * this.innerW();
  yScale = (v: number): number => PAD.top + this.innerH() - (v / this.yMax()) * this.innerH();

  // ── series paths ────────────────────────────────────────────────────────
  readonly seriesA = computed(() => this.buildAreas(this.schedA()));
  readonly totalA = computed(() => this.buildTotal(this.schedA()));
  readonly totalB = computed(() => this.buildTotal(this.schedB()));

  private buildAreas(sched: PaymentDetail[]) {
    if (!sched.length) { return { principalArea: '', interestArea: '', remainingLine: '' }; }
    const interestTop = sched.map((p, i) => `${this.xScale(i)},${this.yScale(p.cumInterest)}`);
    const principalTop = sched.map((p, i) => `${this.xScale(i)},${this.yScale(p.cumInterest + p.cumPrincipal)}`);
    const baseline = `${this.xScale(sched.length - 1)},${this.yScale(0)} ${this.xScale(0)},${this.yScale(0)}`;
    return {
      interestArea: `M ${interestTop.join(' L ')} L ${baseline} Z`,
      principalArea: `M ${principalTop.join(' L ')} L ${interestTop.slice().reverse().join(' L ')} Z`,
      remainingLine: `M ${sched.map((p, i) => `${this.xScale(i)},${this.yScale(p.remaining)}`).join(' L ')}`,
    };
  }

  private buildTotal(sched: PaymentDetail[]) {
    if (!sched.length) { return { area: '', line: '' }; }
    const pts = sched.map((p, i) => `${this.xScale(i)},${this.yScale(p.cumPrincipal + p.cumInterest)}`);
    const baseline = `${this.xScale(sched.length - 1)},${this.yScale(0)} ${this.xScale(0)},${this.yScale(0)}`;
    return { area: `M ${pts.join(' L ')} L ${baseline} Z`, line: `M ${pts.join(' L ')}` };
  }

  // ── axes ────────────────────────────────────────────────────────────────
  readonly yTicks = computed(() => {
    const max = this.yMax();
    const step = niceStep(max / 5);
    const out: { v: number; y: number; label: string }[] = [];
    for (let v = 0; v <= max; v += step) { out.push({ v, y: this.yScale(v), label: compactMoney(v) }); }
    return out;
  });

  readonly xTicks = computed(() => {
    const ref = this.axisRef();
    if (!ref.length) { return []; }
    const n = ref.length;
    return [0, Math.floor(n * 0.33), Math.floor(n * 0.66), n - 1].map(i => ({
      i,
      x: this.xScale(i),
      label: ref[Math.min(i, ref.length - 1)].dateObj.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' }),
    }));
  });

  // ── lump markers ────────────────────────────────────────────────────────
  readonly lumpMarkers = computed<LumpMarker[]>(() => {
    const sched = this.schedA();
    const lumps = this.compareMode() ? this.lumpSumsB() : this.lumpSums();
    const out: LumpMarker[] = [];
    for (const ls of lumps) {
      if (!ls.date || !ls.amount) { continue; }
      const idx = sched.findIndex(p => p.date >= ls.date);
      if (idx >= 0) { out.push({ idx, amount: ls.amount, date: ls.date }); }
    }
    return out;
  });

  // ── payoff markers (only when the loan finishes before the full term) ────
  readonly payoffMarkers = computed<PayoffMarker[]>(() => {
    const axis = this.axisLen();
    const make = (sched: PaymentDetail[], color: string): PayoffMarker | null => {
      if (sched.length === 0 || sched.length >= axis) { return null; }
      const x = this.xScale(sched.length - 1);
      const anchor: 'start' | 'end' = x > this.W() * 0.62 ? 'end' : 'start';
      return {
        x,
        labelX: anchor === 'end' ? x - 7 : x + 7,
        anchor,
        color,
        label: sched[sched.length - 1].dateObj.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' }),
      };
    };
    if (!this.compareMode()) {
      const m = make(this.schedA(), 'var(--principal)');
      return m ? [m] : [];
    }
    return [make(this.schedA(), 'var(--scenario-a)'), make(this.schedB(), 'var(--scenario-b)')]
      .filter((m): m is PayoffMarker => m !== null);
  });

  // ── hover ───────────────────────────────────────────────────────────────
  readonly hoverA = computed<PaymentDetail | null>(() => {
    const h = this.hover(); const a = this.schedA();
    return h && a.length ? a[Math.min(h.idx, a.length - 1)] : null;
  });
  readonly hoverB = computed<PaymentDetail | null>(() => {
    const h = this.hover(); const b = this.schedB();
    return h && b.length ? b[Math.min(h.idx, b.length - 1)] : null;
  });

  readonly tooltipDate = computed(() => {
    const p = this.hoverA() ?? this.hoverB();
    return p ? p.dateObj.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  });
  readonly tooltipLeftPct = computed(() => {
    const h = this.hover();
    return h ? (h.x / this.W()) * 100 : 0;
  });
  readonly tooltipTransform = computed(() => {
    const h = this.hover();
    const right = h ? h.x > this.W() / 2 : false;
    return `translate(${right ? 'calc(-100% - 12px)' : '12px'}, -50%)`;
  });
  readonly diffAtHover = computed(() => {
    const a = this.hoverA(); const b = this.hoverB();
    if (!a || !b) { return 0; }
    return Math.abs((a.cumPrincipal + a.cumInterest) - (b.cumPrincipal + b.cumInterest));
  });

  onMouseMove(e: MouseEvent): void {
    const svg = e.currentTarget as SVGSVGElement;
    this.updateHoverFromClientX(svg, e.clientX);
  }

  onTouch(e: TouchEvent): void {
    const t = e.touches[0];
    if (!t) { return; }
    const svg = e.currentTarget as SVGSVGElement;
    this.updateHoverFromClientX(svg, t.clientX);
  }

  private updateHoverFromClientX(svg: SVGSVGElement, clientX: number): void {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * this.W();
    if (x < PAD.left || x > this.W() - PAD.right) { this.hover.set(null); return; }
    const t = (x - PAD.left) / this.innerW();
    let idx = Math.round(t * (this.axisLen() - 1));
    idx = Math.min(idx, Math.max(0, this.dataLen() - 1)); // never past the actual data
    this.hover.set({ x: this.xScale(idx), idx });
  }

  // template formatting shorthands
  m = (n: number): string => money(n);
  exact = (n: number): string => moneyExact(n);
}
