import { pool } from '../config/db.js';

export async function applyRoleAndUserMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update users table constraint to allow 'student'
    await client.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('hod', 'lecturer', 'secretary', 'student'));
    `);

    // Ensure students table has user_id foreign key
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Ensure users table has student_id foreign key for bidirectional lookup
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id) ON DELETE SET NULL;
    `);

    await client.query('COMMIT');
    console.log('✓ Migration applied: role check updated to include student, user_id/student_id added.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration error:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('apply-migrations.js')) {
  applyRoleAndUserMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
