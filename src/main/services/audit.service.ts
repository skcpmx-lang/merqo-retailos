import { BaseRepository } from '../db/repositories/base';

export interface AuditLogInput {
  businessId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: string | null;
  newValues?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class AuditService extends BaseRepository {
  log(input: AuditLogInput) {
    try {
      const id = this.generateId();
      const now = this.now();

      this.db.prepare(`
        INSERT INTO audit_logs (id, business_id, user_id, action, entity_type, entity_id, before_json, after_json, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.businessId,
        input.userId || null,
        input.action,
        input.entityType,
        input.entityId || null,
        input.oldValues || null,
        input.newValues || null,
        input.ipAddress || null,
        input.userAgent || null,
        now
      );

      return id;
    } catch (e) {
      console.error('Audit log failed:', e);
      throw e;
    }
  }

  findByEntity(entityType: string, entityId: string) {
    const rows = this.db.prepare('SELECT * FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC').all(entityType, entityId) as any[];
    return rows;
  }

  findByBusiness(businessId: string, limit = 100) {
    const rows = this.db.prepare('SELECT * FROM audit_logs WHERE business_id = ? ORDER BY created_at DESC LIMIT ?').all(businessId, limit) as any[];
    return rows;
  }
}
