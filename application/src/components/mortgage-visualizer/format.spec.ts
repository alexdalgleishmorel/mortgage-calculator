import {
  caretAfterDigits, cleanMoneyInput, compactMoney, digitsBefore,
  duration, formatMoneyDraft, money, moneyExact,
} from './format';

describe('money formatting helpers', () => {
  it('formats compact and exact money', () => {
    expect(money(1234.5)).toBe('$1,235');
    expect(money(1_250_000, { compact: true })).toBe('$1.25M');
    expect(money(12_500, { compact: true })).toBe('$13k');
    expect(moneyExact(1234.5)).toBe('$1,234.50');
    expect(money(null)).toBe('—');
  });

  it('formats compact axis labels', () => {
    expect(compactMoney(0)).toBe('$0');
    expect(compactMoney(12_000)).toBe('$12k');
    expect(compactMoney(1_200_000)).toBe('$1.2M');
  });

  it('renders durations', () => {
    expect(duration(0)).toBe('—');
    expect(duration(365.25 * 8 + 30.4375 * 4)).toBe('8 yr 4 mo');
  });
});

describe('live money input helpers', () => {
  it('strips non-numerics, keeping at most one decimal point', () => {
    expect(cleanMoneyInput('1,234.56')).toBe('1234.56');
    expect(cleanMoneyInput('$1.2.3.4')).toBe('1.234');
    expect(cleanMoneyInput('abc')).toBe('');
  });

  it('groups the integer part and passes the fractional part through', () => {
    expect(formatMoneyDraft('')).toBe('');
    expect(formatMoneyDraft('0')).toBe('0');
    expect(formatMoneyDraft('1000000')).toBe('1,000,000');
    expect(formatMoneyDraft('1234.')).toBe('1,234.');
    expect(formatMoneyDraft('1234.50')).toBe('1,234.50');
    expect(formatMoneyDraft('007')).toBe('7');
  });

  it('keeps the caret stable across separator shifts', () => {
    // "1,0000" with caret after the 5th digit → reformatted "10,000", caret at end
    expect(digitsBefore('1,0000', 6)).toBe(5);
    expect(caretAfterDigits('10,000', 5)).toBe(6);
    // caret right after the first "0" in "10,234" stays put
    expect(digitsBefore('10,234', 2)).toBe(2);
    expect(caretAfterDigits('10,234', 2)).toBe(2);
    expect(caretAfterDigits('1,234', 0)).toBe(0);
  });
});
