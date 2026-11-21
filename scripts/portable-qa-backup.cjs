'use strict';
// Portable, authenticated encryption of ALREADY EXPORTED INKR SQL/Storage backups.
// No Supabase API calls, secrets, production writes or machine-bound DPAPI usage.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { Transform, Writable } = require('node:stream');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const MAGIC = Buffer.from('INKR-PORTABLE-v1\n', 'ascii');
const SALT = 16, IV = 12, TAG = 16, HEADER = MAGIC.length + SALT + IV;
const SCRYPT = Object.freeze({ N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });

async function getKey(password, salt) {
  if (typeof password !== 'string' || password.length < 16) throw Error('Passphrase must have at least 16 characters');
  return scrypt(Buffer.from(password, 'utf8'), salt, 32, SCRYPT);
}
function tempFile(dest) {
  return path.join(path.dirname(dest), '.' + path.basename(dest) + '.' + process.pid + '.' + crypto.randomBytes(6).toString('hex') + '.partial');
}
async function publish(temp, dest) {
  // Fails without clobbering an existing destination, including in a race.
  await fsp.link(temp, dest);
  await fsp.unlink(temp);
}
async function encrypt(source, dest, password) {
  if (path.resolve(source) === path.resolve(dest)) throw Error('Source and destination must differ');
  const stat = await fsp.stat(source);
  if (!stat.isFile() || !stat.size) throw Error('Source must be a non-empty regular file');
  const salt = crypto.randomBytes(SALT), iv = crypto.randomBytes(IV);
  const header = Buffer.concat([MAGIC, salt, iv]);
  const key = await getKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(header);
  const temp = tempFile(dest), sha = crypto.createHash('sha256');
  try {
    await fsp.writeFile(temp, header, { flag: 'wx', mode: 0o600 });
    await pipeline(fs.createReadStream(source),
      new Transform({ transform(b, _enc, done) { sha.update(b); done(null, b); } }),
      cipher, fs.createWriteStream(temp, { flags: 'a', mode: 0o600 }));
    await fsp.appendFile(temp, cipher.getAuthTag());
    await publish(temp, dest);
    return { bytes: stat.size, sha256: sha.digest('hex') };
  } finally { key.fill(0); await fsp.unlink(temp).catch(() => {}); }
}
async function openEnvelope(source, password) {
  const stat = await fsp.stat(source);
  if (!stat.isFile() || stat.size <= HEADER + TAG) throw Error('Invalid backup size');
  const fd = await fsp.open(source, 'r');
  let header, tag;
  try {
    header = Buffer.alloc(HEADER); tag = Buffer.alloc(TAG);
    if ((await fd.read(header, 0, HEADER, 0)).bytesRead !== HEADER ||
        !header.subarray(0, MAGIC.length).equals(MAGIC)) throw Error('Unsupported archive format');
    if ((await fd.read(tag, 0, TAG, stat.size - TAG)).bytesRead !== TAG) throw Error('Missing authentication tag');
  } finally { await fd.close(); }
  const key = await getKey(password, header.subarray(MAGIC.length, MAGIC.length + SALT));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length + SALT));
  decipher.setAAD(header); decipher.setAuthTag(tag);
  return { key, decipher, input: fs.createReadStream(source, { start: HEADER, end: stat.size - TAG - 1 }) };
}
async function verify(source, password) {
  const { key, decipher, input } = await openEnvelope(source, password);
  const sha = crypto.createHash('sha256'); let bytes = 0;
  try {
    await pipeline(input, decipher, new Writable({ write(b, _enc, done) { sha.update(b); bytes += b.length; done(); } }));
    if (!bytes) throw Error('Empty backup payload');
    return { bytes, sha256: sha.digest('hex') };
  } finally { key.fill(0); }
}
async function decrypt(source, dest, password) {
  if (path.resolve(source) === path.resolve(dest)) throw Error('Source and destination must differ');
  const { key, decipher, input } = await openEnvelope(source, password);
  const temp = tempFile(dest), sha = crypto.createHash('sha256'); let bytes = 0;
  try {
    // GCM writes plaintext while streaming. Publish only AFTER tag verification.
    await pipeline(input, decipher,
      new Transform({ transform(b, _enc, done) { sha.update(b); bytes += b.length; done(null, b); } }),
      fs.createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
    if (!bytes) throw Error('Empty backup payload');
    await publish(temp, dest);
    return { bytes, sha256: sha.digest('hex') };
  } finally { key.fill(0); await fsp.unlink(temp).catch(() => {}); }
}
async function readHidden(prompt) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw Error('Interactive terminal required; no command-line passwords');
  process.stderr.write(prompt); let value = '';
  process.stdin.setRawMode(true); process.stdin.resume();
  try {
    return await new Promise((resolve, reject) => {
      function onData(b) {
        for (const ch of b.toString('utf8')) {
          if (ch === '\x03') { cleanup(); reject(Error('Cancelled')); return; }
          if (ch === '\r' || ch === '\n') { cleanup(); process.stderr.write('\n'); resolve(value); return; }
          if (ch === '\x7f' || ch === '\b') value = value.slice(0, -1);
          else if (!/\p{Cc}/u.test(ch)) value += ch;
        }
      }
      function cleanup() { process.stdin.off('data', onData); }
      process.stdin.on('data', onData);
    });
  } finally { process.stdin.setRawMode(false); process.stdin.pause(); }
}
async function cli(args) {
  const [command, source, destination] = args;
  if (!['encrypt','verify','decrypt'].includes(command) || !source ||
      (command === 'verify' ? Boolean(destination) : !destination))
    throw Error('Usage: portable-qa-backup.cjs encrypt <source> <archive.inkrbak> | verify <archive.inkrbak> | decrypt <archive.inkrbak> <output>');
  const password = await readHidden('Backup passphrase (hidden): ');
  if (command === 'encrypt' && await readHidden('Confirm passphrase (hidden): ') !== password)
    throw Error('Passphrases do not match');
  const result = command === 'encrypt' ? await encrypt(source, destination, password) :
    command === 'verify' ? await verify(source, password) : await decrypt(source, destination, password);
  console.log(JSON.stringify({ action: command, ...result }));
}
if (require.main === module) cli(process.argv.slice(2)).catch(e => {
  console.error('FAIL — ' + e.message); process.exitCode = 1;
});
module.exports = { encrypt, decrypt, verify };
