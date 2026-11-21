/**
 * Read-only INKR staging authorization test using two real Supabase Auth sessions.
 * No production URL is accepted. No credentials are printed, persisted or committed.
 * Required env vars: INKR_QA_CLIENT_EMAIL, INKR_QA_CLIENT_PASSWORD,
 * INKR_QA_ARTIST_EMAIL, INKR_QA_ARTIST_PASSWORD.
 * Optional: INKR_QA_STAGING_ANON_KEY (or local public-key file).
 */
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const STAGING_URL = 'https://lsewxsdulunuuzmszegm.supabase.co';
const LOCAL = process.env.LOCALAPPDATA;
const KEY_FILE = LOCAL && path.join(LOCAL, 'INKR-QA', 'secrets', 'staging-anon-publishable.key');
const OUTPUT_FILE = LOCAL && path.join(LOCAL, 'INKR-QA', 'clone', 'staging-auth-live-audit.json');

const output = (message) => console.log(message);
const ensure = (value, message) => { if (!value) throw new Error(message); };
const required = [
  'INKR_QA_CLIENT_EMAIL','INKR_QA_CLIENT_PASSWORD',
  'INKR_QA_ARTIST_EMAIL','INKR_QA_ARTIST_PASSWORD'
];
async function run() {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    output('INKR_STAGING_AUTH_QA=HOLD: missing locally authorized test-account credentials');
    return 2;
  }
  const anonKey = process.env.INKR_QA_STAGING_ANON_KEY ||
    (KEY_FILE && fs.existsSync(KEY_FILE) ? fs.readFileSync(KEY_FILE,'utf8').trim() : '');
  ensure(anonKey, 'Staging public key missing');
  const makeClient = () => createClient(STAGING_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const client = makeClient();
  const artist = makeClient();
  const sessions = [
    { label: 'client', db: client, email: process.env.INKR_QA_CLIENT_EMAIL,
      password: process.env.INKR_QA_CLIENT_PASSWORD },
    { label: 'artist', db: artist, email: process.env.INKR_QA_ARTIST_EMAIL,
      password: process.env.INKR_QA_ARTIST_PASSWORD },
  ];
  try {
    for (const s of sessions) {
      const { data, error } = await s.db.auth.signInWithPassword({
        email: s.email, password: s.password,
      });
      ensure(!error && data?.user?.id, s.label + ': authentication failed');
      s.userId = data.user.id;
    }
    ensure(sessions[0].userId !== sessions[1].userId, 'Test accounts must be distinct');
    const results = {};
    for (const s of sessions) {
      const { data: profile, error: profileError } = await s.db.from('profiles')
        .select('role').eq('id', s.userId).maybeSingle();
      ensure(!profileError && profile, s.label + ': own profile unreadable');
      ensure(profile.role === (s.label === 'client' ? 'user' : 'artist'),
        s.label + ': wrong profile role for QA');
      s.artistId = null;
      if (s.label === 'artist') {
        const { data: ownArtist, error: artistError } = await s.db.from('artists')
          .select('id').eq('profile_id', s.userId).maybeSingle();
        ensure(!artistError && ownArtist, 'Artist test account has no artist record');
        s.artistId = ownArtist.id;
      }
      const own = (record, clientField, artistField) =>
        record[clientField] === s.userId ||
        (s.artistId && record[artistField] === s.artistId);
      const tables = [
        { table: 'appointments', cols: 'id,client_id,artist_id', valid: r => own(r,'client_id','artist_id') },
        { table: 'tattoo_requests', cols: 'id,client_id,artist_id', valid: r => own(r,'client_id','artist_id') },
        { table: 'appointment_deposit_requests', cols: 'appointment_id,client_id,artist_id', valid: r => own(r,'client_id','artist_id') },
        { table: 'notifications', cols: 'id,user_id', valid: r => r.user_id === s.userId }
      ];
      const counts = {};
      s.rows = {};
      for (const spec of tables) {
        const { data, error } = await s.db.from(spec.table).select(spec.cols).limit(200);
        ensure(!error && Array.isArray(data), s.label + ': read failed for ' + spec.table);
        ensure(data.every(spec.valid), s.label + ': unauthorized row visible in ' + spec.table);
        counts[spec.table] = data.length;
        s.rows[spec.table] = data;
      }
      results[s.label] = { profile_role: profile.role, authorized_rows: counts };
    }
    const [c,a] = sessions;
    const artistOnly = a.rows.appointments.find(r => r.client_id !== c.userId);
    if (artistOnly) {
      const { data,error }=await c.db.from('appointments').select('id').eq('id',artistOnly.id);
      ensure(!error && data.length === 0,'Cross-account client appointment disclosure');
    }
    const clientOtherArtist = c.rows.appointments.find(r => r.artist_id !== a.artistId);
    if (clientOtherArtist) {
      const { data,error }=await a.db.from('appointments').select('id').eq('id',clientOtherArtist.id);
      ensure(!error && data.length === 0,'Cross-account artist appointment disclosure');
    }
    const report = {
      status:'PASS_AUTHENTICATED_READONLY',
      staging_ref:'lsewxsdulunuuzmszegm',
      executed_at:new Date().toISOString(),
      client:results.client,
      artist:results.artist,
      cross_account_denial_checked:Boolean(artistOnly||clientOtherArtist),
      app_ui_and_write_flows_tested:false
    };
    if (OUTPUT_FILE) fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report,null,2)+'\n', {mode:0o600});
    output('INKR_STAGING_AUTH_QA=PASS_AUTHENTICATED_READONLY');
    output('CROSS_ACCOUNT_NEGATIVE_TEST='+(report.cross_account_denial_checked?'PASS':'SKIPPED_NO_NONPARTICIPANT_CASE'));
    return 0;
  } finally {
    for (const s of sessions) {
      await s.db.auth.signOut({ scope:'local' }).catch(() => {});
    }
  }
}
run().then(code=>{process.exitCode=code}).catch(err=>{
  output('INKR_STAGING_AUTH_QA=HOLD: '+String(err.message).replace(/\S+@\S+/g,'[redacted]'));
  process.exitCode=1;
});
