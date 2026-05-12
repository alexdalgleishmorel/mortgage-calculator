// Mortgage math — ported from Angular app's calculator.ts, extended to support
// per-payment recurring extras AND one-off lump sums on specific dates.
//
// All amounts CAD. Periodic compounding matches frequency:
//   monthly:                rate/12, 30-day step
//   bi-weekly:              rate/26, 14-day step
//   accelerated-bi-weekly:  payment = monthly/2, rate/26 interest, 14-day step
//
// The "accelerated" variant pays the equivalent of one extra monthly payment
// per year — that's the standard Canadian definition. We compute the monthly
// payment, halve it, and apply every 14 days.

function parseDate(s) {
  // YYYY-MM-DD without timezone surprises
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

window.MortgageMath = {
  parseDate, fmtDate, addDays,

  // params: {
  //   purchasePrice, downPayment, interestRate (annual %), termYears,
  //   frequency: 'monthly'|'bi-weekly'|'accelerated-bi-weekly',
  //   recurringExtra: number (added every periodic payment),
  //   lumpSums: [{date: 'YYYY-MM-DD', amount: number}],
  //   startDate: 'YYYY-MM-DD'
  // }
  calculate(params) {
    const {
      purchasePrice, downPayment, interestRate, termYears, frequency,
      recurringExtra = 0, lumpSums = [], startDate
    } = params;

    const principal0 = Math.max(0, purchasePrice - downPayment);
    let periodRate, numPayments, intervalDays, basePayment;

    const monthlyRate = interestRate / 100 / 12;
    const totalMonths = termYears * 12;
    const monthlyPayment = monthlyRate === 0
      ? principal0 / totalMonths
      : (principal0 * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -totalMonths));

    switch (frequency) {
      case 'monthly':
        periodRate = monthlyRate;
        numPayments = totalMonths;
        intervalDays = 30;
        basePayment = monthlyPayment;
        break;
      case 'bi-weekly':
        periodRate = interestRate / 100 / 26;
        numPayments = termYears * 26;
        intervalDays = 14;
        // Equivalent bi-weekly payment that mirrors the monthly schedule
        basePayment = periodRate === 0
          ? principal0 / numPayments
          : (principal0 * periodRate) / (1 - Math.pow(1 + periodRate, -numPayments));
        break;
      case 'accelerated-bi-weekly':
        periodRate = interestRate / 100 / 26;
        numPayments = termYears * 26;
        intervalDays = 14;
        basePayment = monthlyPayment / 2; // accelerated: half the monthly
        break;
      default:
        throw new Error('Invalid frequency: ' + frequency);
    }

    // Index lump sums by date for fast lookup; allow multiple on same date
    const lumpByDate = new Map();
    for (const ls of lumpSums) {
      if (!ls.date || !ls.amount) continue;
      lumpByDate.set(ls.date, (lumpByDate.get(ls.date) || 0) + Number(ls.amount));
    }

    const schedule = [];
    let remaining = principal0;
    let totalInterest = 0;
    let totalPrincipal = 0;
    let date = parseDate(startDate);
    const maxIterations = numPayments * 2; // safety cap when extras shorten term

    for (let i = 0; i < maxIterations && remaining > 0.005; i++) {
      const interest = remaining * periodRate;
      let principalPaid = basePayment + recurringExtra - interest;

      // Apply one-off lump sum dated on/before this payment but after the last one
      // For simplicity: apply lumps whose date <= this payment date and not yet applied
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

    // Apply any remaining lump sums that fall after payoff — they don't matter
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
  },

  // Format helpers
  money(n, opts = {}) {
    if (n == null || isNaN(n)) return '—';
    const abs = Math.abs(n);
    if (opts.compact && abs >= 1000) {
      if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
      if (abs >= 1e3) return '$' + (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1).replace(/\.?0+$/, '') + 'k';
    }
    return '$' + Math.round(n).toLocaleString('en-CA');
  },
  moneyExact(n) {
    if (n == null || isNaN(n)) return '—';
    return '$' + n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  percent(n) {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(2) + '%';
  },
  // "8 yr 4 mo"
  duration(days) {
    if (!days || days < 0) return '—';
    const years = Math.floor(days / 365.25);
    const months = Math.round((days - years * 365.25) / 30.4375);
    if (years === 0 && months === 0) return '< 1 mo';
    const parts = [];
    if (years > 0) parts.push(years + ' yr');
    if (months > 0) parts.push(months + ' mo');
    return parts.join(' ');
  },
  monthName(d) {
    return d.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
  },
  fullDate(d) {
    return d.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
  },
};
