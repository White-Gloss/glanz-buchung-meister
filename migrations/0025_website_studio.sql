-- Additive Website Studio schema. Apply only with the separate release approval.
-- Existing published CMS content is preserved; opening the editor does not migrate it.
alter table cms_items add column if not exists studio_key text;
alter table cms_items add column if not exists draft_revision_id integer;
alter table cms_items add column if not exists published_revision_id integer;
alter table cms_items add column if not exists archived_at timestamptz;
create unique index if not exists cms_studio_key_idx on cms_items(shop_id, studio_key);
create unique index if not exists cms_shop_id_id_idx on cms_items(shop_id, id);

create table if not exists cms_revisions (
  id serial primary key,
  shop_id text not null default 'white-gloss',
  item_id integer not null,
  content jsonb not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  restored_from_revision_id integer,
  foreign key (shop_id, item_id) references cms_items(shop_id, id),
  unique (shop_id, item_id, id),
  foreign key (shop_id, item_id, restored_from_revision_id) references cms_revisions(shop_id, item_id, id),
  check (jsonb_typeof(content) = 'object')
);
alter table cms_items add constraint cms_draft_belongs_to_item
  foreign key (shop_id, id, draft_revision_id) references cms_revisions(shop_id, item_id, id);
alter table cms_items add constraint cms_publication_belongs_to_item
  foreign key (shop_id, id, published_revision_id) references cms_revisions(shop_id, item_id, id);
create index if not exists cms_revision_history_idx on cms_revisions(shop_id, item_id, id desc);

create table if not exists cms_media (
  id uuid primary key,
  shop_id text not null default 'white-gloss',
  original_name text not null,
  alt text not null default '',
  caption text not null default '',
  approved boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  width integer not null check (width > 0 and width <= 10000),
  height integer not null check (height > 0 and height <= 10000),
  bytes integer not null check (bytes > 0 and bytes <= 12582912),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  version integer not null default 1 check (version > 0)
);
create index if not exists cms_media_shop_active_idx on cms_media(shop_id, archived_at, created_at desc);

-- The application database owner accesses these server-only tables. Direct API
-- roles must never read drafts, actor identities or unpublished image metadata.
alter table cms_revisions enable row level security;
alter table cms_media enable row level security;
revoke all on cms_revisions, cms_media from public;
revoke all on sequence cms_revisions_id_seq from public;
do $studio_roles$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on cms_revisions, cms_media from %I', role_name);
      execute format('revoke all on sequence cms_revisions_id_seq from %I', role_name);
    end if;
  end loop;
end
$studio_roles$;
