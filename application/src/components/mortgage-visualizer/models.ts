import { LumpSum, PaymentFrequency, fmtDate } from './mortgage-calculator';

export type { LumpSum, PaymentFrequency };

/** Local-time YYYY-MM-DD for "today". */
export function todayISO(): string {
  return fmtDate(new Date());
}

export type ScenarioColor = 'a' | 'b';
export type RecurringExtraMode = '$' | '%';
export type ScenarioMode = 'single' | 'compare';

export interface Scenario {
  purchasePrice: number;
  downPayment: number;
  interestRate: number;            // annual %
  termYears: number;
  frequency: PaymentFrequency;
  recurringExtra: number;          // stored in dollars
  recurringExtraMode: RecurringExtraMode;
  lumpSums: LumpSum[];
  startDate: string;               // YYYY-MM-DD
}

export const DEFAULTS: Scenario = {
  purchasePrice: 0,
  downPayment: 0,
  interestRate: 5.25,
  termYears: 25,
  frequency: 'monthly',
  recurringExtra: 0,
  recurringExtraMode: '$',
  lumpSums: [],
  startDate: todayISO(),
};

export const DEFAULTS_B: Scenario = {
  ...DEFAULTS,
  recurringExtra: 200,
  frequency: 'accelerated-bi-weekly',
};
