const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function edge({ silentHealedDelete }) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/delete-account/index.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  const calls = [];
  let handler;
  let healedExists = true;
  const admin = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'client-id' } }, error: null }),
      admin: { deleteUser: async () => { calls.push('delete-user'); return { error: null }; } },
    },
    from(table) {
      return { select() {
        return { eq() {
          return table === 'artists'
            ? { maybeSingle: async () => ({ data: null, error: null }) }
            : Promise.resolve({ data: [], error: null });
        } };
      } };
    },
    storage: { from(bucket) {
      return {
        list: async () => ({ data: bucket === 'healed-photos' && healedExists
          ? [{ id: 'file-id', name: 'photo.jpg' }] : [], error: null }),
        remove: async () => {
          calls.push(`remove-${bucket}`);
          if (!silentHealedDelete) healedExists = false;
          return { data: [], error: null };
        },
      };
    } },
  };
  const requireStub = (name) => {
    if (name.includes('deno.land')) return { serve: (fn) => { handler = fn; } };
    if (name.includes('esm.sh')) return { createClient: () => admin };
    if (name.includes('_shared/http')) return {
      bearerToken: () => 'jwt', corsHeaders: () => ({}),
      json: (_req, body, status = 200) => new Response(JSON.stringify(body), { status }),
    };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function('require', 'module', 'exports', 'Deno', 'console', code)(
    requireStub, { exports: {} }, {}, { env: { get: () => 'test' } }, { error: () => {} },
  );
  return { handler, calls };
}

test('account deletion does not claim success while a healed photo remains', async () => {
  const { handler, calls } = edge({ silentHealedDelete: true });
  const response = await handler(new Request('https://example.test/delete-account', { method: 'POST' }));
  assert.equal(response.status, 500);
  assert.equal((await response.json()).deleted, undefined);
  assert.ok(calls.includes('remove-healed-photos'));
  assert.ok(!calls.includes('delete-user'), 'the account must remain retryable');
});

test('account deletion removes healed media before deleting the user', async () => {
  const { handler, calls } = edge({ silentHealedDelete: false });
  const response = await handler(new Request('https://example.test/delete-account', { method: 'POST' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deleted, true);
  assert.ok(calls.includes('remove-healed-photos'));
  assert.ok(calls.indexOf('remove-healed-photos') < calls.indexOf('delete-user'));
});
