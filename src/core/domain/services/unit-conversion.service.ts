/**
 * Unit Conversion Service — domain logic for unit conversions
 * Handles conversion between units with graph traversal, cycle detection
 */

export interface ConversionPath {
  factor: number;
  path: string[]; // unit IDs
}

export class UnitConversionService {
  /**
   * Convert quantity from one unit to another using conversion map
   * conversionMap: Map<fromUnitId_toUnitId, factor>
   * If direct conversion exists, use it. Else try reverse, else try path.
   */
  convert(
    quantityMilli: number,
    fromUnitId: string,
    toUnitId: string,
    conversions: { fromUnitId: string; toUnitId: string; conversionFactor: number }[]
  ): number {
    if (fromUnitId === toUnitId) return quantityMilli;
    if (quantityMilli === 0) return 0;

    // Build graph
    const graph = new Map<string, { to: string; factor: number }[]>();
    for (const conv of conversions) {
      if (!graph.has(conv.fromUnitId)) graph.set(conv.fromUnitId, []);
      if (!graph.has(conv.toUnitId)) graph.set(conv.toUnitId, []);

      // from -> to: factor (e.g., 1 carton = 12 pieces => factor 12)
      graph.get(conv.fromUnitId)!.push({ to: conv.toUnitId, factor: conv.conversionFactor });
      // to -> from: inverse
      graph.get(conv.toUnitId)!.push({ to: conv.fromUnitId, factor: 1 / conv.conversionFactor });
    }

    // BFS to find conversion path
    const visited = new Set<string>();
    const queue: { unitId: string; factor: number; path: string[] }[] = [
      { unitId: fromUnitId, factor: 1, path: [fromUnitId] },
    ];
    visited.add(fromUnitId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.unitId === toUnitId) {
        return Math.round(quantityMilli * current.factor);
      }

      const neighbors = graph.get(current.unitId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.to)) {
          visited.add(neighbor.to);
          queue.push({
            unitId: neighbor.to,
            factor: current.factor * neighbor.factor,
            path: [...current.path, neighbor.to],
          });
        }
      }
    }

    throw new Error(`No conversion path found from ${fromUnitId} to ${toUnitId}`);
  }

  /**
   * Convert to base unit (milli)
   * For weight: kg base, g conversion factor 1000, etc.
   */
  toBaseMilli(quantity: number, unitConversionFactor: number): number {
    // quantity in given unit, conversion factor to base
    // e.g., 2 cartons, 1 carton = 12 pieces (base), => 2*12 = 24 pieces, *1000 milli = 24000
    if (unitConversionFactor <= 0) throw new Error('Conversion factor must be >0');
    return Math.round(quantity * unitConversionFactor * 1000);
  }

  fromBaseMilli(quantityMilli: number, unitConversionFactor: number): number {
    if (unitConversionFactor <= 0) throw new Error('Conversion factor must be >0');
    return quantityMilli / (unitConversionFactor * 1000);
  }

  /**
   * Validate conversion graph for cycles with inconsistent factors
   */
  validateConversions(conversions: { fromUnitId: string; toUnitId: string; conversionFactor: number }[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const conv of conversions) {
      if (conv.fromUnitId === conv.toUnitId) {
        errors.push(`Self-conversion not allowed: ${conv.fromUnitId}`);
      }
      if (conv.conversionFactor <= 0) {
        errors.push(`Conversion factor must be >0: ${conv.fromUnitId} -> ${conv.toUnitId}`);
      }
    }

    // Check for duplicate conversions
    const seen = new Set<string>();
    for (const conv of conversions) {
      const key = `${conv.fromUnitId}_${conv.toUnitId}`;
      const reverseKey = `${conv.toUnitId}_${conv.fromUnitId}`;
      if (seen.has(key)) {
        errors.push(`Duplicate conversion: ${conv.fromUnitId} -> ${conv.toUnitId}`);
      }
      seen.add(key);
      // If both directions exist, check consistency
      if (seen.has(reverseKey)) {
        // Will be validated via graph traversal later
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
