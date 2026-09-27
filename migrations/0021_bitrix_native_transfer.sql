-- Transfer journal only; no customer, document, or historical CRM data is removed.
alter table bitrix_sync_queue add column if not exists details_done boolean not null default false;
alter table bitrix_sync_queue add column if not exists photo_keys text[];
alter table bitrix_sync_queue add column if not exists photos_revision integer not null default 0;
alter table bitrix_sync_queue add column if not exists initial_deal jsonb;
alter table bitrix_sync_queue add column if not exists initial_products jsonb;
update bitrix_sync_queue set details_done=true where synced_version>0;
update bitrix_sync_queue set photo_keys='{}' where synced_version=0 and photo_keys is null;
-- Already transferred legacy photos require reconciliation before adding more;
-- their remote file IDs cannot safely be inferred from filenames.
