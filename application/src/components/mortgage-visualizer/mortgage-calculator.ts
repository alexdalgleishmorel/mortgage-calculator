// Mortgage math — framework-free domain logic. Ported from the original
// Angular `calculator.ts`, extended (per the rework wireframe's math.js) to
// support a per-payment recurring extra AND one-off lump sums on specific dates.
//
// All amounts CAD. Periodic compounding matches frequency:
//   monthly:                rate/12, 30-day step
//   bi-weekly:              rate/26, 14-day step (payment mirrors the monthly schedule)
//   accelerated-bi-weekly:  payment = monthly/2, rate/26 interest, 14-day step
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
  principal: number;               // amount financed (price − down payment)
  basePayment: number;             // periodic principal+interest payment, before extras
  totalInterest: number;
  totalPaid: number;
  payoffDate: string;
  payoffDateObj: Date;
  numPayments: number;
  paid: boolean;
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

  const principal0 = Math.max(0, purchasePrice - downPayment);

  const monthlyRate = interestRate / 100 / 12;
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
      periodRate = interestRate / 100 / 26;
      numPayments = termYears * 26;
      intervalDays = 14;
      // Equivalent bi-weekly payment that mirrors the monthly schedule
      basePayment = periodRate === 0
        ? principal0 / numPayments
        : (principal0 * periodRate) / (1 - Math.pow(1 + periodRate, -numPayments));
      break;
    }
    case 'accelerated-bi-weekly':
      periodRate = interestRate / 100 / 26;
      numPayments = termYears * 26;
      intervalDays = 14;
      basePayment = monthlyPayment / 2; // accelerated: half the monthly payment
      break;
    default:
      throw new Error('Invalid payment frequency: ' + frequency);
  }

  // Index lump sums by date for fast lookup; allow multiple on the same date.
  const lumpByDate = new Map<string, number>();
  for (const ls of lumpSums) {
    if (!ls.date || !ls.amount) { continue; }
    lumpByDate.set(ls.date, (lumpByDate.get(ls.date) || 0) + Number(ls.amount));
  }

  const schedule: PaymentDetail[] = [];
  let remaining = principal0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  let date = parseDate(startDate);
  const maxIterations = numPayments * 2; // safety cap when extras shorten the term

  for (let i = 0; i < maxIterations && remaining > 0.005; i++) {
    const interest = remaining * periodRate;
    let principalPaid = basePayment + recurringExtra - interest;

    // Apply a one-off lump sum dated on this payment date.
    const dateKey = fmtDate(date);
    const lump = lumpByDate.get(dateKey) || 0;
    if (lump > 0) {
      principalPaid += lump;
      lumpByDate.delete(dateKey);
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
  };
}
