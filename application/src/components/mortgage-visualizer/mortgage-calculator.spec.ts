import {
  calculateMortgage, cmhcPremium, MortgageParams, parseDate, fmtDate, addDays,
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
    // Canadian semi-annual compounding: 400k @ 5% / 25y ≈ $2326.42 (vs. $2338.36 under
    // straight monthly compounding — the Interest Act mandates the former for Canadian mortgages).
    expect(r.basePayment).toBeCloseTo(2326.42, 1);
    expect(r.totalInterest).toBeGreaterThan(0);
    expect(r.totalPaid).toBeCloseTo(r.principal + r.totalInterest, 2);
  });

  it('first payment splits into principal + interest correctly', () => {
    const r = calculateMortgage(base);
    const first = r.schedule[0];
    // Canadian semi-annual compounded monthly rate: i = (1 + r/2)^(1/6) − 1.
    const i = Math.pow(1 + 5 / 100 / 2, 1 / 6) - 1;
    expect(first.interestPaid).toBeCloseTo(400_000 * i, 6);
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

  it('applies a lump sum dated between two payments on the next payment', () => {
    // Payment dates step every 30 days, so a date in between (e.g. 10 days
    // after the start, before payment 1) used to be silently dropped under
    // the old exact-match logic.
    const r0 = calculateMortgage(base);
    const between = fmtDate(addDays(r0.schedule[0].dateObj, 10));
    expect(r0.schedule.some(p => p.date === between)).toBeFalse();
    const r = calculateMortgage({ ...base, lumpSums: [{ date: between, amount: 10_000 }] });
    expect(r.schedule[1].extraThisPayment).toBeCloseTo(10_000, 6);
    expect(r.totalInterest).toBeLessThan(r0.totalInterest);
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

describe('CMHC insurance', () => {
  it('no premium when down payment is exactly 20%', () => {
    const r = calculateMortgage(base); // DP 100k / 500k = 20%
    expect(r.insurancePremium).toBe(0);
    expect(r.principal).toBe(400_000);
    expect(r.loanToValue).toBeCloseTo(0.80, 6);
  });

  it('no premium when down payment is over 20%', () => {
    const r = calculateMortgage({ ...base, downPayment: 125_000 }); // 25%
    expect(r.insurancePremium).toBe(0);
    expect(r.principal).toBe(375_000);
  });

  it('applies the 2.80% tier for a 15% down payment', () => {
    const r = calculateMortgage({ ...base, downPayment: 75_000 }); // 15%
    expect(r.insurancePremium).toBeCloseTo(425_000 * 0.028, 6); // 11,900
    expect(r.principal).toBeCloseTo(436_900, 6);
    expect(r.loanToValue).toBeCloseTo(0.85, 6);
  });

  it('applies the 3.10% tier for a 10% down payment', () => {
    const r = calculateMortgage({ ...base, downPayment: 50_000 }); // 10%
    expect(r.insurancePremium).toBeCloseTo(450_000 * 0.031, 6);
    expect(r.principal).toBeCloseTo(450_000 + 450_000 * 0.031, 6);
    expect(r.loanToValue).toBeCloseTo(0.90, 6);
  });

  it('applies the 4.00% tier for a 5% down payment', () => {
    const r = calculateMortgage({ ...base, downPayment: 25_000 }); // 5%
    expect(r.insurancePremium).toBeCloseTo(475_000 * 0.040, 6); // 19,000
    expect(r.principal).toBeCloseTo(494_000, 6);
    expect(r.loanToValue).toBeCloseTo(0.95, 6);
  });

  it('rolls the premium into amortization, raising total interest vs. 20% DP', () => {
    const uninsured = calculateMortgage({ ...base, downPayment: 100_000 });
    const insured = calculateMortgage({ ...base, downPayment: 75_000 });
    // Apples to apples: the insured scenario finances 11,900 more — interest should rise.
    expect(insured.totalInterest).toBeGreaterThan(uninsured.totalInterest);
    expect(insured.basePayment).toBeGreaterThan(uninsured.basePayment);
  });

  it('boundary: DP just under 20% uses the 2.80% tier; exactly 20% uses none', () => {
    const justUnder = calculateMortgage({ ...base, downPayment: 99_950 }); // 19.99%
    expect(justUnder.insurancePremium).toBeCloseTo((500_000 - 99_950) * 0.028, 6);
    const exact = calculateMortgage({ ...base, downPayment: 100_000 });
    expect(exact.insurancePremium).toBe(0);
  });

  it('cmhcPremium returns 0 when the down payment covers the price', () => {
    expect(cmhcPremium(500_000, 500_000)).toBe(0);
    expect(cmhcPremium(500_000, 600_000)).toBe(0);
    expect(cmhcPremium(0, 0)).toBe(0);
  });

  it('adds the 0.20% surcharge for amortizations over 25 years', () => {
    // 15% DP → base tier 2.80%; with 30-year amortization → 3.00%.
    const baseLoan = 425_000;
    expect(cmhcPremium(500_000, 75_000, 25)).toBeCloseTo(baseLoan * 0.028, 6);
    expect(cmhcPremium(500_000, 75_000, 26)).toBeCloseTo(baseLoan * 0.030, 6);
    expect(cmhcPremium(500_000, 75_000, 30)).toBeCloseTo(baseLoan * 0.030, 6);
  });

  it('matches a known Canadian example (price 493,483.56, DP 74,022.54, 4.39% / 30y)', () => {
    const r = calculateMortgage({
      purchasePrice: 493_483.56,
      downPayment: 74_022.54,
      interestRate: 4.39,
      termYears: 30,
      frequency: 'monthly',
      startDate: '2026-06-01',
    });
    expect(r.insurancePremium).toBeCloseTo(12_583.83, 2);
    expect(r.principal).toBeCloseTo(432_044.85, 2);
    expect(r.basePayment).toBeCloseTo(2150.87, 2);
  });
});

describe('date helpers', () => {
  it('round-trips YYYY-MM-DD without timezone drift', () => {
    expect(fmtDate(parseDate('2026-06-01'))).toBe('2026-06-01');
    expect(fmtDate(addDays(parseDate('2026-01-31'), 1))).toBe('2026-02-01');
  });
});
