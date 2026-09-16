/**
 * Unit Conversion — graph-based conversion between units
 * Example: 1 carton = 24 pieces
 * Stores conversion factor as number (how many to_unit per 1 from_unit)
 */

export interface ConversionEdge {
  fromUnitId: string;
  toUnitId: string;
  factor: number; // must be >0
}

export class UnitConversion {
  private adjacency: Map<string, Array<{ to: string; factor: number }>> = new Map();

  constructor(edges: ConversionEdge[]) {
    for (const edge of edges) {
      if (edge.factor <= 0) {
        throw new Error(`Conversion factor must be >0, got ${edge.factor}`);
      }
      if (edge.fromUnitId === edge.toUnitId) {
        throw new Error(`Cannot convert unit to itself: ${edge.fromUnitId}`);
      }
      // Add forward edge
      if (!this.adjacency.has(edge.fromUnitId)) {
        this.adjacency.set(edge.fromUnitId, []);
      }
      this.adjacency.get(edge.fromUnitId)!.push({ to: edge.toUnitId, factor: edge.factor });

      // Add reverse edge (1/factor)
      if (!this.adjacency.has(edge.toUnitId)) {
        this.adjacency.set(edge.toUnitId, []);
      }
      this.adjacency.get(edge.toUnitId)!.push({ to: edge.fromUnitId, factor: 1 / edge.factor });
    }
  }

  /**
   * Convert quantity from one unit to another
   * Uses BFS to find path and multiply factors
   */
  convert(quantity: number, fromUnitId: string, toUnitId: string): number {
    if (fromUnitId === toUnitId) {
      return quantity;
    }

    const visited = new Set<string>();
    const queue: Array<{ unitId: string; factor: number }> = [{ unitId: fromUnitId, factor: 1 }];

    visited.add(fromUnitId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.adjacency.get(current.unitId) || [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor.to)) continue;

        const newFactor = current.factor * neighbor.factor;

        if (neighbor.to === toUnitId) {
          return quantity * newFactor;
        }

        visited.add(neighbor.to);
        queue.push({ unitId: neighbor.to, factor: newFactor });
      }
    }

    throw new Error(`No conversion path from ${fromUnitId} to ${toUnitId}`);
  }

  /**
   * Convert milli quantity (integer) from one unit to base unit milli
   * Uses same logic but with integer arithmetic where possible
   */
  convertMilli(milli: bigint, fromUnitId: string, toUnitId: string): bigint {
    if (fromUnitId === toUnitId) return milli;

    // For simplicity, convert to number, then back to bigint milli
    // In production, use more precise integer math if needed
    const units = Number(milli) / 1000;
    const converted = this.convert(units, fromUnitId, toUnitId);
    return BigInt(Math.round(converted * 1000));
  }

  hasPath(fromUnitId: string, toUnitId: string): boolean {
    try {
      this.convert(1, fromUnitId, toUnitId);
      return true;
    } catch {
      return false;
    }
  }
}
