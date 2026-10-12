import { query } from '../config/db.js';

export async function getAuditLogs(req, res, next) {
  const { action, entity_type, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params = [];

  if (action) {
    params.push(action);
    conditions.push(`al.action = $${params.length}`);
  }

  if (entity_type) {
    params.push(entity_type);
    conditions.push(`al.entity_type = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(parseInt(limit, 10));
  const limitIndex = params.length;
  params.push(parseInt(offset, 10));
  const offsetIndex = params.length;

  const countRes = await query(`SELECT COUNT(*) FROM audit_logs al ${whereClause}`, params.slice(0, conditions.length));
  const total = parseInt(countRes.rows[0].count, 10);

  const result = await query(
    `SELECT al.id, al.action, al.entity_type, al.entity_id, al.metadata, al.ip_address, al.created_at,
            u.full_name AS actor_name, u.username AS actor_username, u.role AS actor_role
     FROM audit_logs al
     LEFT JOIN users u ON al.actor_id = u.id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  res.json({
    success: true,
    total,
    count: result.rowCount,
    data: result.rows,
  });
}

export async function getAttendanceCorrections(req, res, next) {
  const { session_id, limit = 100, offset = 0 } = req.query;
  const conditions = [];
  const params = [];

  if (session_id) {
    params.push(session_id);
    conditions.push(`ac.attendance_session_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(parseInt(limit, 10));
  const limitIndex = params.length;
  params.push(parseInt(offset, 10));
  const offsetIndex = params.length;

  const result = await query(
    `SELECT ac.id, ac.previous_status, ac.new_status, ac.reason, ac.created_at,
            s.matric_number, s.full_name AS student_name,
            u.full_name AS actor_name, u.role AS actor_role,
            sess.session_title
     FROM attendance_corrections ac
     JOIN students s ON ac.student_id = s.id
     JOIN users u ON ac.actor_id = u.id
     JOIN attendance_sessions sess ON ac.attendance_session_id = sess.id
     ${whereClause}
     ORDER BY ac.created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  res.json({
    success: true,
    count: result.rowCount,
    data: result.rows,
  });
}
