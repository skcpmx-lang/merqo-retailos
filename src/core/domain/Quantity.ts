/**
 * Quantity value object — stores quantity in milli-units (base unit * 1000)
 * Example: 1.5 kg → 1500 milli
 * Avoids FLOAT for inventory calculations
 */

export class Quantity {
  public readonly milli: bigint;

  private constructor(milli: bigint) {
    this.milli = milli;
  }

  static fromMilli(milli: number | bigint): Quantity {
    if (typeof milli === 'number') {
      if (!Number.isInteger(milli)) {
        throw new Error(`Milli must be integer, got ${milli}`);
      }
      return new Quantity(BigInt(milli));
    }
    return new Quantity(milli);
  }

  static fromUnits(units: number): Quantity {
    // Convert units to milli, handling float safely
    // 1.5 → 1500
    const scaled = Math.round(units * 1000);
    return new Quantity(BigInt(scaled));
  }

  static zero(): Quantity {
    return new Quantity(0n);
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.milli + other.milli);
  }

  subtract(other: Quantity): Quantity {
    return new Quantity(this.milli - other.milli);
  }

  multiply(factor: number): Quantity {
    const factorScaled = Math.round(factor * 1000);
    const result = this.milli * BigInt(factorScaled);
    const rounded = result >= 0n ? (result + 500n) / 1000n : (result - 500n) / 1000n;
    return new Quantity(rounded);
  }

  isZero(): boolean {
    return this.milli === 0n;
  }

  isPositive(): boolean {
    return this.milli > 0n;
  }

  isNegative(): boolean {
    return this.milli < 0n;
  }

  equals(other: Quantity): boolean {
    return this.milli === other.milli;
  }

  greaterThan(other: Quantity): boolean {
    return this.milli > other.milli;
  }

  lessThan(other: Quantity): boolean {
    return this.milli < other.milli;
  }

  toUnits(): number {
    return Number(this.milli) / 1000;
  }

  toMilli(): number {
    return Number(this.milli);
  }

  toBigInt(): bigint {
    return this.milli;
  }

  format(): string {
    // Format with up to 3 decimal places, trim trailing zeros
    const units = this.toUnits();
    return units.toLocaleString('en-BD', { maximumFractionDigits: 3 });
  }

  static sum(quantities: Quantity[]): Quantity {
    return quantities.reduce((acc, q) => acc.add(q), Quantity.zero());
  }
}
