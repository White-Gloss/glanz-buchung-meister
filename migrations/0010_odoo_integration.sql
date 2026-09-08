alter table shop_settings
  add column if not exists odoo_base_url text,
  add column if not exists odoo_database text,
  add column if not exists odoo_api_key text;

comment on column shop_settings.odoo_api_key is
  'Server-only Odoo API key. Never expose this value to browser code or logs.';
