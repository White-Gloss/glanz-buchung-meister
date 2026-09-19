// One-off cleanup of the two explicitly identified September 19 internal tests.
// Dry-run by default. Never selects real customer bookings or deletes storage objects.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { backupProduction } from '/var/tmp/wg-ro-backup.mjs';
if (process.getuid?.() !== 0) throw new Error('root_required');
const { Pool } = createRequire(`${process.cwd()}/package.json`)('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const db = await pool.connect();
const expected = new Map([[48, ['INTERNER TEST RO Fotoablauf', '62884012']], [49, ['INTERNER TEST Fotoanfrage', '62884217']]]);
const ids = [...expected.keys()];
let stopped = false;
try {
  if (process.argv.includes('--apply')) {
    stopped = true;
    execFileSync('systemctl', ['stop', 'white-gloss-reminder.timer', 'white-gloss-reminder.service', 'white-gloss.service']);
  }
  await db.query('begin');
  await db.query('lock table bookings in access exclusive mode');
  const rows = (await db.query('select b.id,b.shop_id,b.customer_name,q.ro_order_id from bookings b left join roapp_sync_queue q on q.booking_id=b.id where b.id=any($1::int[]) order by b.id', [ids])).rows;
  if (!rows.length) { console.log(JSON.stringify({alreadyClean:true})); }
  else {
    if (rows.length !== 2 || rows.some(r => r.shop_id !== 'white-gloss' || r.customer_name !== expected.get(r.id)?.[0] || String(r.ro_order_id) !== expected.get(r.id)?.[1])) throw new Error('test_identity_mismatch');
    const photos = (await db.query('select storage_path from booking_photos where booking_id=any($1::int[])', [ids])).rows;
    console.log(JSON.stringify({validatedInternalBookings:rows.length,photoLinks:photos.length,apply:process.argv.includes('--apply')}));
    if (process.argv.includes('--apply')) {
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const dir = `/var/backups/white-gloss/${stamp}-test-cleanup`;
      // Release the read-only transaction before pg_dump acquires its own locks.
      await db.query('rollback');
      const backup = await backupProduction(`${dir}/database.dump`);
      if (!backup.ok || !backup.archiveListValid) throw new Error('backup_not_verified');
      await writeFile(`${dir}/test-photo-paths.json`, JSON.stringify(photos), {mode:0o600});
      await db.query('begin');
      await db.query('lock table bookings in access exclusive mode');
      const current = (await db.query('select id,customer_name from bookings where id=any($1::int[]) order by id',[ids])).rows;
      if (current.length !== 2 || current.some(r=>r.customer_name !== expected.get(r.id)?.[0])) throw new Error('test_population_changed');
      for (const table of ['booking_events','odoo_sync_queue','roapp_sync_queue','lexware_sync_queue','bitrix_sync_queue','zoho_job_queue','zoho_sync_queue','booking_agent_runs','outbound_queue']) {
        if ((await db.query('select to_regclass($1) as relation',[table])).rows[0].relation) await db.query(`delete from ${table} where booking_id=any($1::int[])`,[ids]);
      }
      await db.query('alter table bookings disable trigger booking_workflow_guard');
      const removed = await db.query('delete from bookings where id=any($1::int[])',[ids]);
      await db.query('alter table bookings enable trigger booking_workflow_guard');
      await db.query('commit');
      console.log(JSON.stringify({removedInternalBookings:removed.rowCount,revokedPhotoLinks:photos.length,backup:dir}));
    }
  }
  await db.query('rollback');
} catch (error) {
  await db.query('rollback').catch(()=>{});
  console.error('test_cleanup_failed', error.code || error.message);
  process.exitCode=1;
} finally {
  db.release(); await pool.end();
  if (stopped) execFileSync('systemctl',['start','white-gloss.service','white-gloss-reminder.timer']);
}
