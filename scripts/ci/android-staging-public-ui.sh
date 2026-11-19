#!/usr/bin/env bash
set -Eeuo pipefail

# INKR public staging UI on Android 15, no sign-in and no data mutations.
# The APK is compiled with a PUBLIC Supabase publishable key, never a service key.
PACKAGE=com.inkr.tattoo
OUT="${RUNNER_TEMP:-/tmp}/inkr-android-staging-ui"
mkdir -p "$OUT"

# Collect evidence even if a tap launches the system home screen or the app dies.
collect_diagnostics() {
  adb logcat -d -b crash > "$OUT/post-interaction-crash-buffer.txt" 2>/dev/null || true
  adb logcat -d -t 15000 > "$OUT/post-interaction-logcat.txt" 2>/dev/null || true
  adb shell dumpsys activity activities > "$OUT/activity-state.txt" 2>/dev/null || true
  adb shell pidof "$PACKAGE" > "$OUT/app-pid.txt" 2>/dev/null || true
}
trap collect_diagnostics EXIT

capture() {
  local name="$1"
  adb shell uiautomator dump /sdcard/inkr-stage.xml >/dev/null 2>&1
  adb exec-out cat /sdcard/inkr-stage.xml > "$OUT/$name.xml"
  adb exec-out screencap -p > "$OUT/$name.png"
}

wait_for_text() {
  local phrase="$1" label="$2"
  local found=0
  for attempt in $(seq 1 16); do
    capture "$label"
    if grep -Fq "$phrase" "$OUT/$label.xml"; then
      found=1
      break
    fi
    sleep 3
  done
  if [[ "$found" != 1 ]]; then
    echo "::error::Missing public UI text '$phrase' at $label"
    return 1
  fi
  echo "::notice::Public UI $label contains '$phrase'"
}

if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
  echo "::error::The smoke test must launch INKR first."
  exit 1
fi

# Starting on a real staging server: public test artist and feed should load.
wait_for_text "Mara Test" home
if grep -Fq "Le fil est indisponible" "$OUT/home.xml"; then
  echo "::error::Real staging feed failed to load."
  exit 1
fi

# Use on-screen tab for Explore. Fixed 1080x2400 Pixel 6 emulator profile.
size="$(adb shell wm size | tr -d '\r')"
if [[ "$size" != *"1080x2400"* ]]; then
  echo "::error::Unexpected emulator resolution; manual tap coordinates unsafe: $size"
  exit 1
fi
adb shell input tap 540 2270
wait_for_text "La bonne rencontre" explore

# Explore can start at the top of a long ScrollView: scroll if needed.
if ! grep -Fq "Mara Test" "$OUT/explore.xml"; then
  adb shell input swipe 580 1780 580 700 500
  wait_for_text "Mara Test" explore_artist
else
  cp "$OUT/explore.xml" "$OUT/explore_artist.xml"
fi

# Check that public tabs lead to the sign-in screen, without credentials.
adb shell input tap 902 2270
sleep 2
if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
  echo "::error::INKR process exited immediately after tapping the sign-in tab."
  exit 1
fi
adb shell dumpsys activity activities > "$OUT/after-sign-in-tap-activity.txt" 2>/dev/null || true
wait_for_text "Entrez dans l" sign_in

# Verify Android URI intent delivery to the actual callback screen using
# a synthetic provider error: no OTP, JWT, password, or backend mutation.
adb shell am start -W -a android.intent.action.VIEW \
  -d "inkr://auth/callback?error=access_denied" "$PACKAGE" > "$OUT/deep-link-intent.txt"
if ! grep -Eq 'com\.inkr\.tattoo|Status: ok' "$OUT/deep-link-intent.txt"; then
  echo "::error::Android did not dispatch INKR Auth callback URI."
  exit 1
fi
wait_for_text "Connexion" callback_error

# No real PKCE verification was attempted. This run verifies only public UI,
# Android intent dispatch, and visibly handled bad links.
echo "::notice::INKR Android live staging public UI and callback error handling passed."
