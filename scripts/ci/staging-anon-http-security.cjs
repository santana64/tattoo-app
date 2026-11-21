#!/usr/bin/env node
'use strict';

/**
 * Real HTTP authorization/CORS regression against isolated INKR staging only.
 * No signed user sessions, schema writes, Stripe Checkout sessions or production URL.
 *
 * Run with INKR_STAGING_PUBLIC_KEY from a trusted local/CI secret store.
 * Never pass service_role or sb_secret keys into this script.
 */
const assert = require('node:assert/strict');
const STAGING = 'https://lsewxsdulunuuzmszegm.supabase.co';
const KEY = process.env.INKR_STAGING_PUBLIC_KEY || '';
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(KEY)) {
  console.error('HOLD — staging publishable key is required (sb_publishable_...)');
  process.exit(2);
}
const GOOD_ORIGINS = Object.freeze([
  'https://tattoo-app-4gmu-prrqvs0jx-santana64s-projects.vercel.app',
  'https://tattoo-app-4gmu-po0g25qat-santana64s-projects.vercel.app',
]);
const BAD_ORIGIN = 'https://attacker-example.invalid';

async function request(route, init = {}) {
  const response = await fetch(STAGING + route, {
    ...init,
    headers: { apikey: KEY, 'content-type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  const body = await response.text();
  let data;
  try { data = JSON.parse(body); } catch { data = null; }
  return { response, data };
}
function privateDenied({ response, data }) {
  return [401,403].includes(response.status)
    || (response.status === 200 && Array.isArray(data) && data.length === 0);
}

async function main() {
  const cases = [
    ['requests', '/rest/v1/tattoo_requests?select=id&limit=1', {method:'GET'}],
    ['messages', '/rest/v1/messages?select=id&limit=1', {method:'GET'}],
    ['appointments', '/rest/v1/appointments?select=id&limit=1', {method:'GET'}],
    ['deposits', '/rest/v1/appointment_deposit_requests?select=appointment_id&limit=1', {method:'GET'}],
    ['private_storage', '/storage/v1/object/list/request-references', {method:'POST',body:JSON.stringify({prefix:'',limit:20,offset:0})}],
    // Both RPCs are read-only SECURITY DEFINER functions guarded by assert_admin().
    ['admin_reports', '/rest/v1/rpc/admin_list_reports', {method:'POST',body:JSON.stringify({p_status:'pending'})}],
    ['admin_verifications', '/rest/v1/rpc/admin_list_verifications', {method:'POST',body:'{}'}],
  ];
  const checks = [];
  for (const [name, route, options] of cases) {
    const reply = await request(route, options);
    const pass = privateDenied(reply)
      && (!name.startsWith('admin_') || [401,403].includes(reply.response.status));
    checks.push({ name, pass, status: reply.response.status });
    console.log(name + ' ' + (pass ? 'PASS' : 'HOLD') + ' HTTP=' + reply.response.status);
    assert.ok(pass, name + ': private resource or privileged RPC is exposed');
  }

  for (const origin of [...GOOD_ORIGINS, BAD_ORIGIN]) {
    const { response } = await request('/functions/v1/create-checkout-session', {
      method:'OPTIONS',
      headers: {
        Origin:origin,
        'Access-Control-Request-Method':'POST',
        'Access-Control-Request-Headers':'authorization,apikey,content-type,x-client-info',
      },
    });
    const allowed=response.headers.get('access-control-allow-origin');
    const trusted=GOOD_ORIGINS.includes(origin);
    const pass = trusted
      ? response.status === 200 && allowed === origin
      : allowed !== '*' && allowed !== origin;
    checks.push({name:trusted?'owned_preview_cors':'foreign_cors_denied',pass,status:response.status});
    console.log((trusted?'owned_preview_cors':'foreign_cors_denied') + ' ' + (pass?'PASS':'HOLD') + ' HTTP=' + response.status);
    assert.ok(pass, 'Checkout CORS failed scoped-origin check');
  }
  console.log('INKR_STAGING_ANON_HTTP_QA=PASS (' + checks.length + '/' + checks.length + ' checks; production untouched)');
}
main().catch((error) => {
  console.error('INKR_STAGING_ANON_HTTP_QA=HOLD: ' + String(error.message).slice(0,160));
  process.exitCode = 1;
});
