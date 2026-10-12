import { query } from '../config/db.js';

export async function logAudit(req, { action, entityType, entityId, metadata = {} }) {
  try {
    const actorId = req?.session?.user?.id || null;
    const ipAddress = req?.ip || req?.socket?.remoteAddress || 'unknown';

    await query(
      `
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [actorId, action, entityType, String(entityId || ''), JSON.stringify(metadata), ipAddress]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}
