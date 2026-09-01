create table if not exists shop_settings (
  shop_id text primary key default 'white-gloss',
  operator_pin text not null default 'WG-BETRIEB',
  updated_at timestamptz not null default now()
);
insert into shop_settings (shop_id, operator_pin)
values ('white-gloss', 'WG-BETRIEB')
on conflict (shop_id) do nothing;
