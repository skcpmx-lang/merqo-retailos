/**
 * Money value object — stores amount in paisa (BDT * 100) as bigint
 * Never use FLOAT for financial values
 * Example: ৳ 125.50 → 12550 paisa
 */

export class Money {
  public readonly paisa: bigint;

  private constructor(paisa: bigint) {
    this.paisa = paisa;
  }

  static fromPaisa(paisa: number | bigint): Money {
    if (typeof paisa === 'number') {
      if (!Number.isInteger(paisa)) {
        throw new Error(`Paisa must be integer, got ${paisa}`);
      }
      return new Money(BigInt(paisa));
    }
    return new Money(paisa);
  }

  static fromBDT(bdt: number): Money {
    // Convert BDT to paisa, handling float safely
    // Use string conversion to avoid float errors
    const bdtStr = bdt.toString();
    const [whole, frac = ''] = bdtStr.split('.');
    const fracPadded = (frac + '00').slice(0, 2);
    const paisa = BigInt(whole) * 100n + BigInt(fracPadded.padStart(2, '0')) * (bdt < 0 ? -1n : 1n);
    // Handle negative correctly
    if (bdt < 0) {
      const absWhole = BigInt(whole.replace('-', ''));
      const absPaisa = absWhole * 100n + BigInt(fracPadded);
      return new Money(-absPaisa);
    }
    return new Money(BigInt(whole) * 100n + BigInt(fracPadded));
  }

  static zero(): Money {
    return new Money(0n);
  }

  add(other: Money): Money {
    return new Money(this.paisa + other.paisa);
  }

  subtract(other: Money): Money {
    return new Money(this.paisa - other.paisa);
  }

  multiply(factor: number): Money {
    // factor can be float, but result rounded to nearest paisa
    // Use integer arithmetic: multiply paisa * factor*1000 /1000
    const factorScaled = Math.round(factor * 1000);
    const result = (this.paisa * BigInt(factorScaled) + 500n) / 1000n; // rounding
    // Better: handle negative
    const result2 = this.paisa * BigInt(factorScaled);
    const rounded = result2 >= 0n ? (result2 + 500n) / 1000n : (result2 - 500n) / 1000n;
    return new Money(rounded);
  }

  multiplyByPercent(percent: number): Money {
    // percent e.g., 10 for 10%
    return this.multiply(percent / 100);
  }

  isZero(): boolean {
    return this.paisa === 0n;
  }

  isPositive(): boolean {
    return this.paisa > 0n;
  }

  isNegative(): boolean {
    return this.paisa < 0n;
  }

  equals(other: Money): boolean {
    return this.paisa === other.paisa;
  }

  greaterThan(other: Money): boolean {
    return this.paisa > other.paisa;
  }

  lessThan(other: Money): boolean {
    return this.paisa < other.paisa;
  }

  toBDT(): number {
    return Number(this.paisa) / 100;
  }

  toPaisa(): number {
    // May overflow for very large, but for JS number safe up to 2^53
    return Number(this.paisa);
  }

  toBigInt(): bigint {
    return this.paisa;
  }

  formatBDT(): string {
    // Format as BDT with English digits, e.g., ৳ 1,250.50
    const isNeg = this.paisa < 0n;
    const abs = isNeg ? -this.paisa : this.paisa;
    const bdt = Number(abs / 100n);
    const paisaPart = Number(abs % 100n);
    const bdtFormatted = bdt.toLocaleString('en-BD');
    const paisaStr = paisaPart.toString().padStart(2, '0');
    return `${isNeg ? '-' : ''}৳ ${bdtFormatted}.${paisaStr}`;
  }

  formatBDTWithoutSymbol(): string {
    const isNeg = this.paisa < 0n;
    const abs = isNeg ? -this.paisa : this.paisa;
    const bdt = Number(abs / 100n);
    const paisaPart = Number(abs % 100n);
    const bdtFormatted = bdt.toLocaleString('en-BD');
    const paisaStr = paisaPart.toString().padStart(2, '0');
    return `${isNeg ? '-' : ''}${bdtFormatted}.${paisaStr}`;
  }

  toJSON(): number {
    // For storage, return paisa as number (if safe) or string?
    return this.toPaisa();
  }

  static sum(moneys: Money[]): Money {
    return moneys.reduce((acc, m) => acc.add(m), Money.zero());
  }
}
