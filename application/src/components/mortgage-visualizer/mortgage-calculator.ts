// Mortgage math — framework-free domain logic. Ported from the original
// Angular `calculator.ts`, extended (per the rework wireframe's math.js) to
// support a per-payment recurring extra AND one-off lump sums on specific dates.
//
// All amounts CAD. Canadian mortgages compound semi-annually by law (the
// Interest Act, s. 6), so the nominal annual rate is converted via
//   i_period = (1 + rate/2)^(2/periodsPerYear) - 1
// rather than simply rate / periodsPerYear. Step sizes:
//   monthly:                30-day step
//   bi-weekly:              14-day step (payment mirrors the monthly schedule)
//   accelerated-bi-weekly:  payment = monthly/2, 14-day step
//
// The "accelerated" variant pays the equivalent of one extra monthly payment
// per year — the standard Canadian definition. We compute the monthly payment,
// halve it, and apply every 14 days.

export type PaymentFrequency = 'monthly' | 'bi-weekly' | 'accelerated-bi-weekly';

export interface LumpSum {
  date: string;   // YYYY-MM-DD
  amount: number;
}

export interface MortgageParams {
  purchasePrice: number;
  downPayment: number;
  interestRate: number;            // annual %
  termYears: number;
  frequency: PaymentFrequency;
  recurringExtra?: number;         // added to every periodic payment
  lumpSums?: LumpSum[];            // one-off amounts on specific dates
  startDate: string;               // YYYY-MM-DD
}

export interface PaymentDetail {
  date: string;                    // YYYY-MM-DD
  dateObj: Date;
  remaining: number;
  principalPaid: number;
  interestPaid: number;
  cumPrincipal: number;
  cumInterest: number;
  totalPayment: number;
  extraThisPayment: number;
}

export interface MortgageResult {
  schedule: PaymentDetail[];
  principal: number;               // amount financed (price − down payment + insurance premium)
  basePayment: number;             // periodic principal+interest payment, before extras
  totalInterest: number;
  totalPaid: number;
  payoffDate: string;
  payoffDateObj: Date;
  numPayments: number;
  paid: boolean;
  insurancePremium: number;        // CMHC premium rolled into the loan (0 when DP ≥ 20%)
  loanToValue: number;             // decimal LTV, e.g. 0.90; 0 when purchasePrice ≤ 0
}

// CMHC high-ratio mortgage insurance premium. Returns the dollar amount that
// gets added to the loan when the down payment is under 20% of the purchase
// price. Tiers are based on LTV = (price − dp) / price. CMHC adds a 0.20%
// surcharge to the premium rate for amortizations longer than 25 years.
export function cmhcPremium(
  purchasePrice: number,
  downPayment: number,
  termYears = 25,
): number {
  if (purchasePrice <= 0 || downPayment >= purchasePrice) { return 0; }
  const baseLoan = purchasePrice - downPayment;
  const ltv = baseLoan / purchasePrice;
  if (ltv <= 0.80) { return 0; }                  // DP ≥ 20% — uninsured
  let rate: number;
  if (ltv <= 0.85) { rate = 0.028; }              // DP 15–<20%
  else if (ltv <= 0.90) { rate = 0.031; }         // DP 10–<15%
  else { rate = 0.040; }                          // DP <10%
  if (termYears > 25) { rate += 0.002; }          // extended-amortization surcharge
  return baseLoan * rate;
}

export function parseDate(s: string): Date {
  // YYYY-MM-DD without timezone surprises
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function calculateMortgage(params: MortgageParams): MortgageResult {
  const {
    purchasePrice, downPayment, interestRate, termYears, frequency,
    recurringExtra = 0, lumpSums = [], startDate,
  } = params;

  const baseLoan = Math.max(0, purchasePrice - downPayment);
  const insurancePremium = cmhcPremium(purchasePrice, downPayment, termYears);
  const principal0 = baseLoan + insurancePremium;
  const loanToValue = purchasePrice > 0 ? baseLoan / purchasePrice : 0;

  // Canadian semi-annual compounding: convert the nominal annual rate to the
  // equivalent monthly rate (i_m = (1 + r/2)^(1/6) − 1).
  const semiAnnualRate = interestRate / 100 / 2;
  const monthlyRate = Math.pow(1 + semiAnnualRate, 1 / 6) - 1;
  const totalMonths = termYears * 12;
  const monthlyPayment = monthlyRate === 0
    ? principal0 / totalMonths
    : (principal0 * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalMonths));

  let periodRate: number;
  let numPayments: number;
  let intervalDays: number;
  let basePayment: number;

  switch (frequency) {
    case 'monthly':
      periodRate = monthlyRate;
      numPayments = totalMonths;
      intervalDays = 30;
      basePayment = monthlyPayment;
      break;
    case 'bi-weekly': {
      // Canadian semi-annual compounding → bi-weekly rate (i_bw = (1 + r/2)^(1/13) − 1).
      periodRate = Math.pow(1 + semiAnnualRate, 1 / 13) - 1;
      numPayments = termYears * 26;
      intervalDays = 14;
      // Equivalent bi-weekly payment that mirrors the monthly schedule
      basePayment = periodRate === 0
        ? principal0 / numPayments
        : (principal0 * periodRate) / (1 - Math.pow(1 + periodRate, -numPayments));
      break;
    }
    case 'accelerated-bi-weekly':
      periodRate = Math.pow(1 + semiAnnualRate, 1 / 13) - 1;
      numPayments = termYears * 26;
      intervalDays = 14;
      basePayment = monthlyPayment / 2; // accelerated: half the monthly payment
      break;
    default:
      throw new Error('Invalid payment frequency: ' + frequency);
  }

  // Sort lump sums by date. A lump is applied on the first payment whose date
  // is on or after the lump's date — payment dates step every 30 / 14 days, so
  // requiring an exact match would silently drop lumps dated between payments.
  const pendingLumps = (lumpSums ?? [])
    .filter(ls => ls.date && ls.amount)
    .map(ls => ({ date: ls.date, amount: Number(ls.amount) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const schedule: PaymentDetail[] = [];
  let remaining = principal0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let date = parseDate(startDate);
  const maxIterations = numPayments * 2; // safety cap when extras shorten the term

  for (let i = 0; i < maxIterations && remaining > 0.005; i++) {
    const interest = remaining * periodRate;
    let principalPaid = basePayment + recurringExtra - interest;

    // Apply any lump sums dated on or before this payment.
    const dateKey = fmtDate(date);
    let lump = 0;
    while (pendingLumps.length > 0 && pendingLumps[0].date <= dateKey) {
      lump += pendingLumps.shift()!.amount;
    }
    if (lump > 0) {
      principalPaid += lump;
    }

    if (principalPaid > remaining) {
      principalPaid = remaining;
    }
    remaining -= principalPaid;
    totalInterest += interest;
    totalPrincipal += principalPaid;

    schedule.push({
      date: dateKey,
      dateObj: new Date(date),
      remaining,
      principalPaid,
      interestPaid: interest,
      cumPrincipal: totalPrincipal,
      cumInterest: totalInterest,
      totalPayment: principalPaid + interest,
      extraThisPayment: recurringExtra + lump,
    });

    date = addDays(date, intervalDays);
  }

  return {
    schedule,
    principal: principal0,
    basePayment,
    totalInterest,
    totalPaid: totalPrincipal + totalInterest,
    payoffDate: schedule.length ? schedule[schedule.length - 1].date : startDate,
    payoffDateObj: schedule.length ? schedule[schedule.length - 1].dateObj : parseDate(startDate),
    numPayments: schedule.length,
    paid: !schedule.length || remaining < 0.005,
    insurancePremium,
    loanToValue,
  };
}
