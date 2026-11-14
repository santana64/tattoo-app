#!/usr/bin/env node
// Explicit, opt-in HTTP recipe against the isolated INKR test project only.
// Credentials and sessions are supplied through files outside the repository.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://lsewxsdulunuuzmszegm.supabase.co';
const config = JSON.parse(fs.readFileSync(process.env.INKR_STAGING_CONFIG, 'utf8'));
const sessions = JSON.parse(fs.readFileSync(process.env.INKR_STAGING_SESSIONS, 'utf8'));
const artist = JSON.parse(fs.readFileSync(process.env.INKR_STAGING_ARTIST, 'utf8'));
assert.equal(config.url, STAGING_URL, 'Refusing to run against another project');
assert.match(config.key, /^sb_publishable_[A-Za-z0-9_-]+$/);

const IMAGE_ONE = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAACAAIDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAG/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AVo4Wv//Z', 'base64');
const IMAGE_TWO = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAACAAIDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAVAQEBAAAAAAAAAAAAAAAAAAAGB//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AAFKg//Z', 'base64');

async function userClient(role) {
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.setSession(sessions[role]);
  assert.ifError(error);
  assert.equal(data.user?.id, sessions[role].id);
  return client;
}
async function confirmed(promise) {
  const { data, error } = await promise;
  assert.ifError(error);
  return data;
}
async function imageAt(url) {
  const response = await fetch(url, { cache: 'no-store' });
  return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
}

(async () => {
  const [client, artistUser, third, admin] = await Promise.all(
    ['client', 'artist', 'third', 'admin'].map(userClient),
  );
  const requestId = crypto.randomUUID();
  const path = `${requestId}/ref_0.jpg`;
  const request = await confirmed(client.from('tattoo_requests').insert({
    id: requestId, client_id: sessions.client.id, artist_id: artist.id,
    project_type: 'new', body_zone: 'Avant-bras', size_category: 'm',
    budget_unknown: true, color_preference: 'black_grey',
    description: 'Essai fictif des références privées INKR', flexibility_level: 'open',
    status: 'submitted',
  }).select('id').single());
  assert.equal(request.id, requestId);
  assert.equal((await confirmed(artistUser.from('tattoo_requests').select('id').eq('id', requestId))).length, 1);
  assert.equal((await confirmed(third.from('tattoo_requests').select('id').eq('id', requestId))).length, 0);
  assert.equal((await confirmed(admin.from('tattoo_requests').select('id').eq('id', requestId))).length, 0);

  // A lost insert response can safely reuse the stable id; it never creates a second request.
  const duplicate = await client.from('tattoo_requests').insert({
    id: requestId, client_id: sessions.client.id, artist_id: artist.id,
    project_type: 'new', body_zone: 'Avant-bras', size_category: 'm',
    budget_unknown: true, color_preference: 'black_grey',
    description: 'Essai fictif des références privées INKR', flexibility_level: 'open', status: 'submitted',
  });
  assert.equal(duplicate.error?.code, '23505');
  assert.equal((await confirmed(client.from('tattoo_requests').select('id').eq('id', requestId))).length, 1);

  const bucket = (user) => user.storage.from('request-references');
  await confirmed(bucket(client).upload(path, IMAGE_ONE, { contentType: 'image/jpeg', cacheControl: '0', upsert: true }));
  await confirmed(client.from('request_references').insert({ request_id: requestId, url: path }));
  assert.equal((await confirmed(bucket(artistUser).list(requestId))).filter((x) => x.name === 'ref_0.jpg').length, 1);
  assert.equal((await confirmed(artistUser.from('request_references').select('url').eq('request_id', requestId))).length, 1);
  assert.equal((await confirmed(third.from('request_references').select('url').eq('request_id', requestId))).length, 0);

  const signed = await confirmed(bucket(artistUser).createSignedUrl(path, 300));
  const firstImage = await imageAt(signed.signedUrl);
  assert.equal(firstImage.status, 200);
  assert.ok(firstImage.bytes.equals(IMAGE_ONE));
  assert.equal((await confirmed(bucket(third).list(requestId))).length, 0);
  assert.ok((await bucket(third).createSignedUrl(path, 300)).error);
  assert.ok((await bucket(third).download(path)).error);
  assert.ok((await bucket(third).upload(`${requestId}/ref_1.jpg`, IMAGE_ONE, { contentType: 'image/jpeg' })).error);
  assert.ok((await bucket(artistUser).upload(`${requestId}/ref_1.jpg`, IMAGE_ONE, { contentType: 'image/jpeg' })).error);
  assert.ok((await third.from('request_references').insert({ request_id: requestId, url: `${requestId}/ref_1.jpg` })).error);
  assert.ok((await artistUser.from('request_references').insert({ request_id: requestId, url: `${requestId}/ref_1.jpg` })).error);
  assert.ok((await bucket(client).upload(`${requestId}/ref_3.jpg`, IMAGE_ONE, { contentType: 'image/jpeg' })).error);
  assert.ok((await bucket(client).upload(`${requestId}/ref_1.jpg`, IMAGE_ONE, { contentType: 'image/png' })).error);
  const oversized = await bucket(client).upload(`${requestId}/ref_1.jpg`, Buffer.alloc(10 * 1024 * 1024 + 1), { contentType: 'image/jpeg' });
  assert.equal(oversized.error?.statusCode, '413');

  for (const index of [1, 2]) {
    const extraPath = `${requestId}/ref_${index}.jpg`;
    await confirmed(bucket(client).upload(extraPath, IMAGE_ONE, { contentType: 'image/jpeg', cacheControl: '0' }));
    await confirmed(client.from('request_references').insert({ request_id: requestId, url: extraPath }));
  }
  assert.equal((await confirmed(bucket(client).list(requestId))).filter((x) => /^ref_[0-2]\.jpg$/.test(x.name)).length, 3);

  // Storage may return success with zero deleted rows to unauthorized callers.
  const deniedRemove = await bucket(third).remove([path]);
  assert.equal(deniedRemove.data?.length ?? 0, 0);
  assert.equal((await confirmed(bucket(client).list(requestId))).filter((x) => x.name === 'ref_0.jpg').length, 1);

  await confirmed(bucket(client).upload(path, IMAGE_TWO, { contentType: 'image/jpeg', cacheControl: '0', upsert: true }));
  const replacement = await confirmed(bucket(client).createSignedUrl(path, 300));
  const replacedImage = await imageAt(replacement.signedUrl);
  assert.equal(replacedImage.status, 200);
  assert.ok(replacedImage.bytes.equals(IMAGE_TWO));

  // Reopening uses a fresh authenticated client, not an in-memory cache.
  const reopened = await userClient('client');
  assert.equal((await confirmed(reopened.from('tattoo_requests').select('id').eq('id', requestId))).length, 1);
  assert.equal((await confirmed(bucket(reopened).list(requestId))).filter((x) => /^ref_[0-2]\.jpg$/.test(x.name)).length, 3);
  const shortLink = await confirmed(bucket(client).createSignedUrl(path, 5));
  assert.equal((await imageAt(shortLink.signedUrl)).status, 200);
  await confirmed(bucket(reopened).remove([path]));
  assert.equal((await confirmed(bucket(reopened).list(requestId))).filter((x) => x.name === 'ref_0.jpg').length, 0);
  await confirmed(reopened.from('request_references').delete().eq('request_id', requestId).eq('url', path));
  for (const index of [1, 2]) {
    const extraPath = `${requestId}/ref_${index}.jpg`;
    await confirmed(bucket(reopened).remove([extraPath]));
    await confirmed(reopened.from('request_references').delete().eq('request_id', requestId).eq('url', extraPath));
  }
  assert.equal((await confirmed(reopened.from('request_references').select('id').eq('request_id', requestId))).length, 0);
  assert.equal((await confirmed(bucket(reopened).list(requestId))).filter((x) => /^ref_[0-2]\.jpg$/.test(x.name)).length, 0);
  const cachedLinkStatusAfterDelete = (await imageAt(replacement.signedUrl)).status;
  await new Promise((resolve) => setTimeout(resolve, 6000));
  assert.notEqual((await imageAt(shortLink.signedUrl)).status, 200, 'Expired signed URL remained usable after deletion');
  assert.equal((await confirmed(bucket(reopened).remove([path]))).length, 0);
  console.log(JSON.stringify({ target: STAGING_URL, requestId, cachedLinkStatusAfterDelete, passed: [
    'ownership', 'artist read', 'third-party denial', 'duplicate prevention', 'upload',
    'signed read', 'replacement', 'three slots', 'size and MIME limits', 'short URL expiration',
    'reopen', 'delete', 'retry', 'metadata',
  ] }));
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
