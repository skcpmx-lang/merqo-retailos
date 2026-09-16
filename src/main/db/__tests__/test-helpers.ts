import { createConnection } from '../connection';
import { Migrator } from '../migrator';

export function getTestDb() {
  const db = createConnection({ memory: true });
  const migrator = new Migrator(db);
  migrator.createInitialSchema();
  return db;
}

export function seedBusiness(db: any, businessId: string) {
  db.prepare(`INSERT INTO businesses (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(businessId, 'Test Biz', Date.now(), Date.now());
}
