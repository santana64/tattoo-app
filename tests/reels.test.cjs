const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'reels.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const reels = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, reels, reels.exports);
const { parseReelUrl, reelEmbedUrl, videoFileError, videoExtension, MAX_VIDEO_BYTES } = reels.exports;

// The same patterns the database enforces (migration 010).
const DB_TIKTOK = /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._]{1,64}\/video\/[0-9]{8,24}$/;
const DB_INSTAGRAM = /^https:\/\/www\.instagram\.com\/reel\/[A-Za-z0-9_-]{5,32}\/$/;

test('TikTok links are recognised in their usual shapes', () => {
  const expected = {
    provider: 'tiktok',
    canonicalUrl: 'https://www.tiktok.com/@atelier.noir/video/7301234567890123456',
    embedUrl: 'https://www.tiktok.com/embed/v2/7301234567890123456',
  };
  for (const link of [
    'https://www.tiktok.com/@atelier.noir/video/7301234567890123456',
    'https://www.tiktok.com/@atelier.noir/video/7301234567890123456?is_from_webapp=1&sender_device=pc',
    'tiktok.com/@atelier.noir/video/7301234567890123456/',
    '  https://m.tiktok.com/@atelier.noir/video/7301234567890123456#comments  ',
  ]) {
    assert.deepEqual(parseReelUrl(link), expected, link);
  }
});

test('Instagram reels and posts are normalised to one address', () => {
  const expected = {
    provider: 'instagram',
    canonicalUrl: 'https://www.instagram.com/reel/Cx1-AbC_d9Z/',
    embedUrl: 'https://www.instagram.com/reel/Cx1-AbC_d9Z/embed',
  };
  for (const link of [
    'https://www.instagram.com/reel/Cx1-AbC_d9Z/',
    'https://www.instagram.com/reels/Cx1-AbC_d9Z/?igsh=abc123',
    'https://instagram.com/p/Cx1-AbC_d9Z',
    'instagram.com/atelier.noir/reel/Cx1-AbC_d9Z/',
  ]) {
    assert.deepEqual(parseReelUrl(link), expected, link);
  }
});

test('what the app stores is exactly what the database accepts', () => {
  assert.match(parseReelUrl('tiktok.com/@a_b.c/video/12345678').canonicalUrl, DB_TIKTOK);
  assert.match(parseReelUrl('instagram.com/reel/ABCDE').canonicalUrl, DB_INSTAGRAM);
});

test('anything that is not a TikTok or Instagram video is refused', () => {
  for (const link of [
    '',
    'bonjour',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://vm.tiktok.com/ZMabcdef/',
    'https://www.tiktok.com/@atelier.noir',
    'https://www.tiktok.com/@atelier.noir/video/12',
    'https://www.instagram.com/atelier.noir/',
    'https://www.instagram.com/stories/atelier.noir/123/',
    // Look-alike hosts and tricks that would put a foreign page in the player.
    'https://www.tiktok.com.evil.example/@a/video/7301234567890123456',
    'https://evil.example/https://www.tiktok.com/@a/video/7301234567890123456',
    'https://www.tiktok.com@evil.example/@a/video/7301234567890123456',
    'https://user:pass@www.tiktok.com/@a/video/7301234567890123456',
    'https://www.tiktok.com:8443/@a/video/7301234567890123456',
    'javascript:alert(1)//www.tiktok.com/@a/video/7301234567890123456',
    'ftp://www.instagram.com/reel/Cx1-AbC_d9Z/',
    'https://www.instagram.com/reel/Cx1"onload="alert(1)/',
    'https://www.instagram.com/reel/../../accounts/login/',
    `https://www.tiktok.com/@a/video/7301234567890123456?${'x'.repeat(600)}`,
  ]) {
    assert.equal(parseReelUrl(link), null, link);
  }
});

test('a stored link only becomes a player address if it is still genuine', () => {
  assert.equal(
    reelEmbedUrl('tiktok', 'https://www.tiktok.com/@a/video/7301234567890123456'),
    'https://www.tiktok.com/embed/v2/7301234567890123456',
  );
  assert.equal(
    reelEmbedUrl('instagram', 'https://www.instagram.com/reel/Cx1-AbC_d9Z/'),
    'https://www.instagram.com/reel/Cx1-AbC_d9Z/embed',
  );
  // Provider and address must agree; uploaded videos have no player address.
  assert.equal(reelEmbedUrl('instagram', 'https://www.tiktok.com/@a/video/7301234567890123456'), null);
  assert.equal(reelEmbedUrl('tiktok', 'https://evil.example/video.mp4'), null);
  assert.equal(reelEmbedUrl(null, 'https://cdn.example/video.mp4'), null);
  assert.equal(reelEmbedUrl('tiktok', null), null);
});

test('video files are checked for format, weight and length', () => {
  assert.equal(videoFileError({ size: 10_000_000, mimeType: 'video/mp4', durationMs: 30_000 }), null);
  assert.equal(videoFileError({ size: 10_000_000, mimeType: 'VIDEO/QUICKTIME' }), null);
  assert.equal(videoFileError({}), null);
  assert.match(videoFileError({ mimeType: 'video/x-msvideo' }), /Format/);
  assert.match(videoFileError({ mimeType: 'image/jpeg' }), /Format/);
  assert.match(videoFileError({ size: MAX_VIDEO_BYTES + 1, mimeType: 'video/mp4' }), /50 Mo/);
  assert.equal(videoFileError({ size: MAX_VIDEO_BYTES, mimeType: 'video/mp4' }), null);
  assert.match(videoFileError({ durationMs: 90_001 }), /90 secondes/);
  assert.equal(videoFileError({ durationMs: 90_000 }), null);
});

test('the stored file extension follows the video type', () => {
  assert.equal(videoExtension('video/quicktime'), 'mov');
  assert.equal(videoExtension('video/webm'), 'webm');
  assert.equal(videoExtension('video/mp4'), 'mp4');
  assert.equal(videoExtension(null), 'mp4');
});
