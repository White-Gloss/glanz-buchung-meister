// One-time, explicitly authorized reset of the 18 legacy website bookings.
// Refuses a changed booking population and preserves a verified database backup.
import { createRequire } from 'node:module';
import { readFile, writeFile, rename, copyFile, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { backupProduction } from '/var/tmp/wg-ro-backup.mjs';
if (process.getuid?.() !== 0 || process.argv[2] !== '--apply') throw new Error('explicit_root_apply_required');
const { Pool } = createRequire(`${process.cwd()}/package.json`)('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const db = await pool.connect();
const envFile = '/etc/white-gloss/environment';
const oldEnv = await readFile(envFile, 'utf8');
if (process.env.BOOKING_OPERATIONS === 'roapp') throw new Error('already_activated');
if (!process.env.ROAPP_API_KEY || process.env.ROAPP_WEBHOOK_SECRET?.length < 20) throw new Error('configuration_missing');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dir = `/var/backups/white-gloss/${stamp}`;
let stopped = false, committed = false;
try {
  // Pause both writers for a consistent backup and short maintenance window.
  stopped = true;
  execFileSync('systemctl', ['stop', 'white-gloss-reminder.timer', 'white-gloss-reminder.service', 'white-gloss.service']);
  const backup = await backupProduction(`${dir}/database.dump`);
  if (!backup.ok || !backup.archiveListValid) throw new Error('backup_not_verified');
  await copyFile(envFile, `${dir}/environment`);
  await chmod(`${dir}/environment`, 0o600);
  await db.query('begin');
  await db.query('lock table bookings in access exclusive mode');
  const rows = (await db.query("select id,created_at from bookings where shop_id='white-gloss' order by id")).rows;
  if (rows.length !== 18 || rows.some(row => new Date(row.created_at) >= new Date('2026-09-19T15:53:39Z'))) throw new Error('booking_population_changed');
  const ids = rows.map(row => row.id);
  const photos = (await db.query('select storage_path from booking_photos where booking_id=any($1::int[])', [ids])).rows;
  await writeFile(`${dir}/legacy-photo-paths.json`, JSON.stringify(photos), {mode: 0o600});
  const children = ['booking_events','odoo_sync_queue','roapp_sync_queue','lexware_sync_queue','bitrix_sync_queue','zoho_job_queue','zoho_sync_queue','booking_agent_runs','outbound_queue'];
  for (const table of children) {
    if ((await db.query('select to_regclass($1) as relation', [table])).rows[0].relation)
      await db.query(`delete from ${table} where booking_id=any($1::int[])`, [ids]);
  }
  // The normal business guard forbids deletion; disable only inside this locked reset transaction.
  await db.query('alter table bookings disable trigger booking_workflow_guard');
  const removed = await db.query('delete from bookings where id=any($1::int[])', [ids]);
  await db.query('alter table bookings enable trigger booking_workflow_guard');
  await db.query("update shop_settings set roapp_sync_enabled=true where shop_id='white-gloss'");
  const next = oldEnv.split(/\r?\n/).filter(line => line.split('=')[0].trim() !== 'BOOKING_OPERATIONS');
  next.push('BOOKING_OPERATIONS=roapp');
  await writeFile(envFile + '.roapp', next.join('\n') + '\n', {mode: 0o600});
  await db.query('commit');
  committed = true;
  await rename(envFile + '.roapp', envFile);
  console.log(JSON.stringify({resetBookings:removed.rowCount,retiredPhotos:photos.length,backup:dir,mode:'roapp'}));
} catch (error) {
  await db.query('rollback').catch(()=>{});
  console.error('cutover_failed', {code:error.code || error.message,committed});
  process.exitCode=1;
} finally {
  db.release(); await pool.end();
  if (stopped) execFileSync('systemctl', ['start', 'white-gloss.service', 'white-gloss-reminder.timer']);
}
