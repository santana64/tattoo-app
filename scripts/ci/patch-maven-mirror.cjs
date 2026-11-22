'use strict';
/**
 * CI-only workaround for 429 responses from repo.maven.apache.org.
 *
 * Expo regenerates android/ at build time, so this never modifies shipped
 * source-controlled Gradle files. Retain mavenCentral() as a fallback.
 * Reference: https://docs.cloud.google.com/docs/buildpacks/java
 */
const fs = require('node:fs');
const path = require('node:path');

const mirror = 'maven { url "https://maven-central.storage-download.googleapis.com/maven2/" }';
const files = ['android/build.gradle', 'android/settings.gradle'];
let count = 0;
for (const name of files) {
  const file = path.resolve(name);
  if (!fs.existsSync(file)) continue;
  const original = fs.readFileSync(file, 'utf8');
  const matches = original.match(/mavenCentral\(\)/g) || [];
  if (matches.length === 0) continue;
  // Mirror gets first chance to resolve artifacts. The original official
  // Maven Central resolution remains available for fallback.
  const patched = original.replace(/mavenCentral\(\)/g, `${mirror}\n        mavenCentral()`);
  fs.writeFileSync(file, patched);
  count += matches.length;
  process.stdout.write(`CI Maven mirror: updated ${name} (${matches.length} repositories)\n`);
}
if (count === 0) {
  console.error('CI Maven mirror: no mavenCentral() repositories found in generated Android project');
  process.exitCode = 1;
}
