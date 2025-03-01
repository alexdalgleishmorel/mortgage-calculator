export type PaymentFrequency = 'monthly' | 'bi-weekly' | 'accelerated-bi-weekly';

export interface PaymentDetail {
  paymentDate: string;
  remainingPrincipal: number | null;
  principalPaid: number | null;
  interestPaid: number | null;
  totalPayment: number | null;
}

export interface MortgageParams {
  totalPrice: number;
  downPayment: number;
  interestRate: number; // Annual interest rate in percentage
  termYears: number;
  frequency: PaymentFrequency;
  lumpSumPayment: number; // Lump sum added to each payment
  startDate: string; // Start date of mortgage in YYYY-MM-DD format
}

export function calculateMortgage(
  params: MortgageParams,
  paymentSchedule?: PaymentDetail[]
): PaymentDetail[] {
  const { totalPrice, downPayment, interestRate, termYears, frequency, lumpSumPayment, startDate } = params;
  if (downPayment > totalPrice) {
    throw new Error("Down payment cannot be greater than the total price of the home.");
  }
  const principal = totalPrice - downPayment;
  let rate: number;
  let numPayments: number;
  let paymentInterval: number;

  switch (frequency) {
    case "monthly":
      rate = interestRate / 100 / 12;
      numPayments = termYears * 12;
      paymentInterval = 30; // Approximate month length
      break;
    case "bi-weekly":
    case "accelerated-bi-weekly":
      rate = interestRate / 100 / 26;
      numPayments = termYears * 26;
      paymentInterval = 14; // Bi-weekly interval
      break;
    default:
      throw new Error("Invalid payment frequency");
  }

  // Calculate correct periodic payment
  let periodicPayment = (principal * rate) / (1 - Math.pow(1 + rate, -numPayments));
  let remainingPrincipal = principal;
  let newSchedule: PaymentDetail[] = [];
  let currentDate = new Date(startDate);

  for (let i = 0; i < numPayments && remainingPrincipal > 0; i++) {
    let interestPaid = remainingPrincipal * rate;
    let principalPaid = periodicPayment + lumpSumPayment - interestPaid;

    if (principalPaid > remainingPrincipal) {
      principalPaid = remainingPrincipal;
      periodicPayment = principalPaid + interestPaid;
    }

    newSchedule.push({
      paymentDate: currentDate.toISOString().split('T')[0],
      remainingPrincipal: Math.max(remainingPrincipal, 0),
      principalPaid,
      interestPaid,
      totalPayment: periodicPayment + lumpSumPayment,
    });

    remainingPrincipal -= principalPaid;
    currentDate.setDate(currentDate.getDate() + paymentInterval);
  }

  newSchedule.push({
    paymentDate: currentDate.toISOString().split('T')[0],
    remainingPrincipal: Math.max(remainingPrincipal, 0),
    principalPaid: 0,
    interestPaid: 0,
    totalPayment: 0,
  });

  if (paymentSchedule) {
    // Merge newSchedule into the provided paymentSchedule
    const maxLength = Math.max(newSchedule.length, paymentSchedule.length);
    for (let i = 0; i < maxLength; i++) {
      if (i < newSchedule.length) {
        if (i < paymentSchedule.length) {
          // Update existing entry
          paymentSchedule[i] = newSchedule[i];
        } else {
          // Append new entry
          paymentSchedule.push(newSchedule[i]);
        }
      } else {
        // If computed schedule is shorter, update remaining entries to null values.
        paymentSchedule[i] = {
          paymentDate: paymentSchedule[i].paymentDate,
          remainingPrincipal: null,
          principalPaid: null,
          interestPaid: null,
          totalPayment: null,
        };
      }
    }
    return paymentSchedule;
  }
  return newSchedule;
}
