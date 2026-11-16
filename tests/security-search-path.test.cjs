const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('legacy helpers use a fixed pg_catalog search path without changing behavior', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec([
      'create table public.request_probe (value text);',
      "create function public.guard_request_update() returns trigger language plpgsql as $$ begin new.value := lower(new.value); return new; end; $$;",
      'create trigger guard_probe before insert on public.request_probe for each row execute function public.guard_request_update();',
      "create function public.search_normalize(p_text text) returns text language sql immutable as $$ select translate(lower(coalesce(p_text, '')), 'é', 'e'); $$;",
    ].join('\n'));
    const sql = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20261116132500_pin_legacy_helper_search_path.sql'), 'utf8',
    );
    await db.exec(sql);
    const configs = await db.query(
      "select proname, proconfig from pg_proc where proname in ('guard_request_update', 'search_normalize') order by proname",
    );
    assert.equal(configs.rows.length, 2);
    for (const f of configs.rows) assert.ok(f.proconfig.includes('search_path=pg_catalog'), f.proname);
    const normalized = await db.query("select public.search_normalize('ÉTÉ') as result");
    assert.equal(normalized.rows[0].result, 'ete');
    await db.exec("insert into public.request_probe(value) values ('TEST');");
    const inserted = await db.query('select value from public.request_probe');
    assert.equal(inserted.rows[0].value, 'test', 'existing trigger remains functional');
  } finally {
    await db.close();
  }
});
