const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('legacy SECURITY DEFINER triggers are no longer callable by public roles, but still fire', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec([
      'create role anon nologin;',
      'create role authenticated nologin;',
      'create table public.trigger_probe (id integer primary key);',
      'create table public.trigger_probe_audit (id integer not null);',
      "create function public.probe_security_trigger() returns trigger language plpgsql security definer set search_path = '' as $$ begin insert into public.trigger_probe_audit(id) values (new.id); return new; end; $$;",
      'create trigger on_probe after insert on public.trigger_probe for each row execute function public.probe_security_trigger();',
      'grant usage on schema public to authenticated;',
      'grant insert on public.trigger_probe to authenticated;',
    ].join('\n'));

    const canExecute = async (role) => {
      const res = await db.query(
        "select pg_catalog.has_function_privilege($1, 'public.probe_security_trigger()', 'EXECUTE') as allowed",
        [role],
      );
      return res.rows[0].allowed;
    };
    assert.equal(await canExecute('anon'), true, 'baseline exercises legacy PUBLIC grant');
    assert.equal(await canExecute('authenticated'), true);
    const migration = fs.readFileSync(
      path.join(__dirname, '../supabase/migrations/20261116132000_revoke_public_trigger_execute.sql'), 'utf8',
    );
    await db.exec(migration);
    assert.equal(await canExecute('anon'), false);
    assert.equal(await canExecute('authenticated'), false);
    await db.exec('set role authenticated;');
    try {
      await db.exec('insert into public.trigger_probe(id) values (17);');
    } finally {
      await db.exec('reset role;');
    }
    const result = await db.query('select id from public.trigger_probe_audit');
    assert.deepEqual(result.rows.map((r) => r.id), [17],
      'revoking direct EXECUTE must not disable existing triggers');
  } finally {
    await db.close();
  }
});
