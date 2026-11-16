const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function edge({ silentHealedDelete, artistId = null }) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/delete-account/index.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
  const calls = [];
  let handler;
  const existing = new Set(['healed-photos/client-id/photo.jpg']);
  if (artistId) existing.add(`covers/${artistId}/cover.jpg`);
  const admin = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'client-id' } }, error: null }),
      admin: { deleteUser: async () => { calls.push('delete-user'); return { error: null }; } },
    },
    from(table) {
      return { select() {
        return { eq() {
          return table === 'artists'
            ? { maybeSingle: async () => ({ data: artistId ? { id: artistId } : null, error: null }) }
            : Promise.resolve({ data: [], error: null });
        } };
      } };
    },
    storage: { from(bucket) {
      return {
        list: async (prefix) => ({ data: [...existing]
          .filter((item) => item.startsWith(`${bucket}/${prefix}/`))
          .map((item) => ({ id: 'file-id', name: item.split('/').at(-1) })), error: null }),
        remove: async (paths) => {
          calls.push(`remove-${bucket}-${paths.join(',')}`);
          if (!(silentHealedDelete && bucket === 'healed-photos')) {
            for (const item of paths) existing.delete(`${bucket}/${item}`);
          }
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
  assert.ok(calls.some((call) => call.startsWith('remove-healed-photos-')));
  assert.ok(!calls.includes('delete-user'), 'the account must remain retryable');
});

test('account deletion removes healed media before deleting the user', async () => {
  const { handler, calls } = edge({ silentHealedDelete: false });
  const response = await handler(new Request('https://example.test/delete-account', { method: 'POST' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deleted, true);
  assert.ok(calls.some((call) => call.startsWith('remove-healed-photos-')));
  assert.ok(calls.findIndex((call) => call.startsWith('remove-healed-photos-')) < calls.indexOf('delete-user'));
});

test('an artist cover is removed under the artist id before account deletion', async () => {
  const { handler, calls } = edge({ artistId: 'artist-id', silentHealedDelete: false });
  const response = await handler(new Request('https://example.test/delete-account', { method: 'POST' }));
  assert.equal(response.status, 200);
  assert.ok(calls.includes('remove-covers-artist-id/cover.jpg'));
  assert.ok(calls.indexOf('remove-covers-artist-id/cover.jpg') < calls.indexOf('delete-user'));
});
