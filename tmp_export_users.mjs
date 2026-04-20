import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('Missing env'); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });

const all = [];
let page = 1;
while (true) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.error(error); process.exit(1); }
  all.push(...data.users);
  if (data.users.length < 1000) break;
  page++;
}

const esc = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
};

const headers = ['id','email','phone','created_at','last_sign_in_at','email_confirmed_at','raw_user_meta_data','raw_app_meta_data','identities'];
const rows = [headers.join(',')];
for (const u of all) {
  rows.push([
    esc(u.id), esc(u.email), esc(u.phone), esc(u.created_at),
    esc(u.last_sign_in_at), esc(u.email_confirmed_at),
    esc(u.user_metadata), esc(u.app_metadata),
    esc(u.identities?.map(i => ({ provider: i.provider, id: i.id, identity_data: i.identity_data })) ?? [])
  ].join(','));
}
writeFileSync('/mnt/documents/exports/auth_users.csv', rows.join('\n') + '\n');
console.log(`Exported ${all.length} users`);
