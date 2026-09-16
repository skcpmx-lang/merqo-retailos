import { BaseRepository } from './base';

export interface Unit {
  id: string;
  businessId: string;
  name: string;
  shortName?: string | null;
  nameBn?: string | null;
  isBaseUnit: boolean;
  unitGroup: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UnitConversion {
  id: string;
  businessId: string;
  fromUnitId: string;
  toUnitId: string;
  conversionFactor: number;
  isBaseConversion: boolean;
  createdAt: number;
}

export class UnitRepository extends BaseRepository {
  create(data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>): Unit {
    try {
      const id = this.generateId();
      const now = this.now();
      const unit: Unit = {
        id,
        businessId: data.businessId,
        name: data.name,
        shortName: data.shortName || null,
        nameBn: data.nameBn || null,
        isBaseUnit: data.isBaseUnit ?? false,
        unitGroup: data.unitGroup || 'piece',
        isActive: data.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      };

      this.db.prepare(`
        INSERT INTO units (id, business_id, name, short_name, name_bn, is_base_unit, unit_group, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        unit.id,
        unit.businessId,
        unit.name,
        unit.shortName,
        unit.nameBn,
        unit.isBaseUnit ? 1 : 0,
        unit.unitGroup,
        unit.isActive ? 1 : 0,
        unit.createdAt,
        unit.updatedAt
      );

      return unit;
    } catch (e) {
      this.handleError(e, 'Unit');
    }
  }

  findById(id: string): Unit | null {
    const row = this.db.prepare('SELECT * FROM units WHERE id = ?').get(id) as any;
    return row ? this.mapRow(row) : null;
  }

  findByBusiness(businessId: string): Unit[] {
    const rows = this.db.prepare('SELECT * FROM units WHERE business_id = ? ORDER BY name').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findByGroup(businessId: string, group: string): Unit[] {
    const rows = this.db.prepare('SELECT * FROM units WHERE business_id = ? AND unit_group = ? ORDER BY name').all(businessId, group) as any[];
    return rows.map(r => this.mapRow(r));
  }

  private mapRow(row: any): Unit {
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      shortName: row.short_name,
      nameBn: row.name_bn,
      isBaseUnit: !!row.is_base_unit,
      unitGroup: row.unit_group,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export class UnitConversionRepository extends BaseRepository {
  create(data: Omit<UnitConversion, 'id' | 'createdAt'>): UnitConversion {
    try {
      if (data.fromUnitId === data.toUnitId) {
        throw new Error('Cannot convert unit to itself');
      }
      if (data.conversionFactor <= 0) {
        throw new Error('Conversion factor must be >0');
      }

      const id = this.generateId();
      const now = this.now();
      const conv: UnitConversion = {
        id,
        businessId: data.businessId,
        fromUnitId: data.fromUnitId,
        toUnitId: data.toUnitId,
        conversionFactor: data.conversionFactor,
        isBaseConversion: data.isBaseConversion ?? false,
        createdAt: now,
      };

      this.db.prepare(`
        INSERT INTO unit_conversions (id, business_id, from_unit_id, to_unit_id, conversion_factor, is_base_conversion, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        conv.id,
        conv.businessId,
        conv.fromUnitId,
        conv.toUnitId,
        conv.conversionFactor,
        conv.isBaseConversion ? 1 : 0,
        conv.createdAt
      );

      return conv;
    } catch (e) {
      this.handleError(e, 'UnitConversion');
    }
  }

  findByBusiness(businessId: string): UnitConversion[] {
    const rows = this.db.prepare('SELECT * FROM unit_conversions WHERE business_id = ?').all(businessId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  findConversionsForUnit(unitId: string): UnitConversion[] {
    const rows = this.db.prepare('SELECT * FROM unit_conversions WHERE from_unit_id = ? OR to_unit_id = ?').all(unitId, unitId) as any[];
    return rows.map(r => this.mapRow(r));
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM unit_conversions WHERE id = ?').run(id);
  }

  private mapRow(row: any): UnitConversion {
    return {
      id: row.id,
      businessId: row.business_id,
      fromUnitId: row.from_unit_id,
      toUnitId: row.to_unit_id,
      conversionFactor: row.conversion_factor,
      isBaseConversion: !!row.is_base_conversion,
      createdAt: row.created_at,
    };
  }
}
