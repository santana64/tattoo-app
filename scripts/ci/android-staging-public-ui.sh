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

# Hosted emulators occasionally show a *system launcher* ANR dialog over
# the app. UIAutomator then sees only the dialog even though INKR is loaded
# and visible behind it. Never mistake this for a missing network response.
# The Pixel 6 AVD is fixed at 1080x2400; the Close app button is centred below.
# Guard against system launcher ANRs independently from INKR's own process.
# Android 15 AOSP can label the system home process Quickstep instead of Launcher3.
# Android UIAutomator sees only the dialog while it overlays an otherwise
# functioning application. Dismiss it by closing *the launcher*, not INKR.
wait_for_text() {
  local phrase="$1" label="$2"
  local anr_count=0
  for attempt in $(seq 1 16); do
    capture "$label"
    if grep -Eq "(Pixel Launcher|Launcher3|Quickstep).*(isn.t responding|keeps stopping)" "$OUT/$label.xml"; then
      anr_count=$((anr_count + 1))
      cp "$OUT/$label.xml" "$OUT/$label-launcher-anr-$anr_count.xml"
      cp "$OUT/$label.png" "$OUT/$label-launcher-anr-$anr_count.png"
      if (( anr_count > 3 )); then
        echo "::error::System launcher ANR persisted after $anr_count dismissals ($label)"
        return 1
      fi
      echo "::warning::System launcher ANR overlay ($label): closing launcher, attempt $anr_count/3."
      # Pixel 6 / Android 15 screenshot: "Close app" bounds roughly [70,1143][1010,1296].
      # The native INKR process is separate and must remain alive.
      adb shell input tap 540 1233
      sleep 3
      continue
    fi
    if grep -Fq "$phrase" "$OUT/$label.xml"; then
      echo "::notice::Public UI $label contains '$phrase'"
      return 0
    fi
    sleep 3
  done
  echo "::error::Missing public UI text '$phrase' at $label"
  return 1
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
# The native Masthead kicker is rendered uppercase by the typography system.
# Check actual accessibility-tree text, not the JSX prop's original casing.
wait_for_text "02 / DÉCOUVRIR" explore

# The staging dataset contains two public artists. Check that actual results
# render, without assuming which artist happens to be first on screen.
wait_for_text "2 ARTISTES" explore_artists
wait_for_text "INKR QA Artiste (staging)" explore_artist

# Exercise repeat tab transitions before authentication. A single navigation can
# miss a delayed Fabric mount failure, so inspect the app process every time.
assert_app_alive() {
  local phase="$1"
  if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
    echo "::error::INKR native process exited during $phase."
    collect_diagnostics
    return 1
  fi
}

for pass in 1 2 3; do
  adb shell input tap 170 2270
  wait_for_text "Mara Test" "roundtrip_home_$pass"
  assert_app_alive "roundtrip_home_$pass"
  adb shell input tap 540 2270
  wait_for_text "02 / DÉCOUVRIR" "roundtrip_explore_$pass"
  assert_app_alive "roundtrip_explore_$pass"
done

# Check that public tabs lead to the sign-in screen, without credentials.
adb shell input tap 902 2270
sleep 2
if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
  echo "::error::INKR process exited immediately after tapping the sign-in tab."
  exit 1
fi
adb shell dumpsys activity activities > "$OUT/after-sign-in-tap-activity.txt" 2>/dev/null || true
wait_for_text "Entrez dans" sign_in

# Verify Android URI intent delivery to the actual callback screen using
# a synthetic provider error: no OTP, JWT, password, or backend mutation.
adb shell am start -W -a android.intent.action.VIEW \
  -d "inkr://auth/callback?error=access_denied" "$PACKAGE" > "$OUT/deep-link-intent.txt"
if ! grep -Eq 'com\.inkr\.tattoo|Status: ok' "$OUT/deep-link-intent.txt"; then
  echo "::error::Android did not dispatch INKR Auth callback URI."
  exit 1
fi
wait_for_text "Connexion" callback_error

# Validate that Android lifecycle changes do not kill the JS/native state.
# No user data is written or simulated credentials used.
assert_app_alive "callback_error"
adb shell input keyevent KEYCODE_HOME
sleep 2
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 > "$OUT/foreground-resume.txt"
sleep 3
assert_app_alive "foreground_resume"
capture "foreground_resume"

# Check absence of native application crashes across the whole interaction,
# not only the process PID at the instant we test it.
collect_diagnostics
if grep -Eq 'FATAL EXCEPTION|Process: com\\.inkr\\.tattoo|addViewAt: failed' "$OUT/post-interaction-crash-buffer.txt"; then
  echo "::error::Android crash buffer contains a native crash; inspect the artifact."
  exit 1
fi

# No real PKCE verification was attempted. This run verifies public UI,
# repeat navigation, Android callback error handling, and background resume.
echo "::notice::INKR Android staging public UI, navigation stress, callback error and lifecycle passed."
