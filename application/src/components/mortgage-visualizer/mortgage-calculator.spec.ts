import {
  calculateMortgage, MortgageParams, parseDate, fmtDate, addDays,
} from './mortgage-calculator';

const base: MortgageParams = {
  purchasePrice: 500_000,
  downPayment: 100_000,
  interestRate: 5,
  termYears: 25,
  frequency: 'monthly',
  startDate: '2026-06-01',
};

describe('calculateMortgage', () => {
  it('computes a monthly schedule that fully amortizes', () => {
    const r = calculateMortgage(base);
    expect(r.principal).toBe(400_000);
    expect(r.schedule.length).toBeGreaterThan(0);
    // ~25 years, ~300 payments (give or take rounding at the tail)
    expect(r.schedule.length).toBeLessThanOrEqual(300);
    expect(r.schedule.length).toBeGreaterThan(280);
    expect(r.paid).toBeTrue();
    expect(r.schedule[r.schedule.length - 1].remaining).toBeLessThan(0.005);
    // Standard amortization payment for 400k @ 5% / 25y ≈ $2338.36
    expect(r.basePayment).toBeCloseTo(2338.36, 1);
    expect(r.totalInterest).toBeGreaterThan(0);
    expect(r.totalPaid).toBeCloseTo(r.principal + r.totalInterest, 2);
  });

  it('first payment splits into principal + interest correctly', () => {
    const r = calculateMortgage(base);
    const first = r.schedule[0];
    expect(first.interestPaid).toBeCloseTo(400_000 * (5 / 100 / 12), 6);
    expect(first.principalPaid).toBeCloseTo(r.basePayment - first.interestPaid, 6);
    expect(first.date).toBe('2026-06-01');
    expect(first.cumInterest).toBeCloseTo(first.interestPaid, 6);
    expect(first.cumPrincipal).toBeCloseTo(first.principalPaid, 6);
  });

  it('a recurring extra shortens the term and lowers total interest', () => {
    const plain = calculateMortgage(base);
    const withExtra = calculateMortgage({ ...base, recurringExtra: 500 });
    expect(withExtra.schedule.length).toBeLessThan(plain.schedule.length);
    expect(withExtra.totalInterest).toBeLessThan(plain.totalInterest);
    expect(withExtra.schedule[0].extraThisPayment).toBe(500);
  });

  it('accelerated bi-weekly pays off sooner than plain bi-weekly', () => {
    const monthly = calculateMortgage({ ...base, frequency: 'monthly' });
    const biweekly = calculateMortgage({ ...base, frequency: 'bi-weekly' });
    const accel = calculateMortgage({ ...base, frequency: 'accelerated-bi-weekly' });
    // accelerated payment = monthly payment ÷ 2, applied every 14 days → ~one extra
    // monthly payment a year, so it's larger than the rate-equivalent bi-weekly payment.
    expect(accel.basePayment).toBeCloseTo(monthly.basePayment / 2, 4);
    expect(accel.basePayment).toBeGreaterThan(biweekly.basePayment);
    expect(accel.numPayments).toBeLessThan(biweekly.numPayments);
    expect(accel.totalInterest).toBeLessThan(biweekly.totalInterest);
  });

  it('applies a one-off lump sum on its dated payment', () => {
    // Lump on the 13th monthly payment (2027-06-01, since step is 30 days... use a real schedule date)
    const r0 = calculateMortgage(base);
    const targetDate = r0.schedule[12].date;
    const r = calculateMortgage({ ...base, lumpSums: [{ date: targetDate, amount: 50_000 }] });
    const idx = r.schedule.findIndex(p => p.date === targetDate);
    expect(idx).toBeGreaterThanOrEqual(0);
    const payment = r.schedule[idx];
    expect(payment.extraThisPayment).toBeCloseTo(50_000, 6);
    // remaining at that point should be ~50k lower than the no-lump baseline
    const baselineRemaining = r0.schedule[idx].remaining;
    expect(payment.remaining).toBeLessThan(baselineRemaining - 49_000);
    expect(r.totalInterest).toBeLessThan(r0.totalInterest);
    expect(r.schedule.length).toBeLessThan(r0.schedule.length);
  });

  it('handles a zero interest rate without dividing by zero', () => {
    const r = calculateMortgage({ ...base, interestRate: 0 });
    expect(r.basePayment).toBeCloseTo(400_000 / 300, 6);
    expect(r.totalInterest).toBeCloseTo(0, 6);
    expect(r.schedule.length).toBe(300);
  });

  it('reports payoff date as the last real payment date', () => {
    const r = calculateMortgage(base);
    expect(r.payoffDate).toBe(r.schedule[r.schedule.length - 1].date);
    expect(fmtDate(r.payoffDateObj)).toBe(r.payoffDate);
  });

  it('treats a price equal to the down payment as nothing financed', () => {
    const r = calculateMortgage({ ...base, downPayment: 500_000 });
    expect(r.principal).toBe(0);
    expect(r.schedule.length).toBe(0);
    expect(r.paid).toBeTrue();
    expect(r.payoffDate).toBe(base.startDate);
  });
});

describe('date helpers', () => {
  it('round-trips YYYY-MM-DD without timezone drift', () => {
    expect(fmtDate(parseDate('2026-06-01'))).toBe('2026-06-01');
    expect(fmtDate(addDays(parseDate('2026-01-31'), 1))).toBe('2026-02-01');
  });
});
