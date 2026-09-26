// Root-only preparation. Backs up the database, applies additive RO migrations,
// and stores the verified catalog. Does not enable sync, delete data or restart.
import { createRequire } from "node:module";
import { readFile,writeFile,rename,copyFile,chmod } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const commit=process.argv[2];
if(process.getuid?.()!==0 || !/^[a-f0-9]{7,40}$/.test(commit||""))throw new Error("root_and_commit_required");
const root=`https://raw.githubusercontent.com/white-gloss/glanz-buchung-meister/${commit}/`;
const source=async path=>{const result=await fetch(root+path);if(!result.ok)throw new Error("source_unavailable");return result.text();};
const backupModule="/var/tmp/wg-ro-backup.mjs";
await writeFile(backupModule,await source("scripts/backup-production.mjs"),{mode:0o600});
const {backupProduction}=await import(pathToFileURL(backupModule).href);
const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
const backup=await backupProduction(`/var/backups/white-gloss/${stamp}/database.dump`);
console.log("verified_backup",JSON.stringify(backup));
const require=createRequire(`${process.cwd()}/package.json`);
const {Pool}=require("pg");
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000});
const db=await pool.connect();
try {
  const type=(await db.query("select data_type from information_schema.columns where table_schema='public' and table_name='bookings' and column_name='id'")).rows[0]?.data_type;
  if(type!=="integer")throw new Error("incompatible_booking_schema");
  const counts=await db.query("select (select count(*) from bookings) as bookings,(select count(*) from booking_photos) as photos,(select count(*) from outbound_queue where status in ('queued','blocked')) as pending_notifications");
  console.log("existing_counts",JSON.stringify(counts.rows));
  console.log("booking_foreign_keys",JSON.stringify((await db.query("select conrelid::regclass::text as table_name,pg_get_constraintdef(oid) as definition from pg_constraint where contype='f' and confrelid='bookings'::regclass")).rows));
  await db.query("select pg_advisory_lock(814702061)");
  for(const name of ["0019_roapp_write_journal.sql","0020_roapp_customer_status.sql"]){
    if((await db.query("select name from _migrations where name=$1",[name])).rows.length)continue;
    const migration=await source(`migrations/${name}`);
    await db.query("begin");
    try{await db.query(migration);await db.query("insert into _migrations(name) values($1)",[name]);await db.query("commit");}
    catch(error){await db.query("rollback");throw error;}
    console.log("migration_applied",name);
  }
  const catalog=JSON.parse(await source("ops/roapp-entity-map.json"));
  if(Object.keys(catalog).length!==57 || Object.values(catalog).some(id=>!Number.isSafeInteger(id)||id<=0))throw new Error("catalog_invalid");
  const file="/etc/white-gloss/environment";
  const old=await readFile(file,"utf8");
  await copyFile(file,`/var/backups/white-gloss/${stamp}/environment`);
  await chmod(`/var/backups/white-gloss/${stamp}/environment`,0o600);
  const lines=old.split(/\r?\n/).filter(line=>line.split("=")[0].trim()!=="ROAPP_ENTITY_MAP");
  lines.push(`ROAPP_ENTITY_MAP='${JSON.stringify(catalog)}'`);
  await writeFile(file+".catalog",lines.join("\n")+"\n",{mode:0o600});await rename(file+".catalog",file);
  console.log("catalog_saved",Object.keys(catalog).length);
} catch(error){console.error("stage_failed",error?.code || "check_required");process.exitCode=1;}
finally{await db.query("select pg_advisory_unlock(814702061)").catch(()=>{});db.release();await pool.end();}
