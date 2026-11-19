#!/usr/bin/env bash
set -Eeuo pipefail

PACKAGE="com.inkr.tattoo"
APK="android/app/build/outputs/apk/release/app-release.apk"
OUT="${RUNNER_TEMP:-/tmp}/inkr-android-smoke"
mkdir -p "$OUT"

on_exit() {
  adb logcat -d -b crash > "$OUT/crash-buffer.txt" 2>/dev/null || true
  adb logcat -d -t 3500 > "$OUT/logcat.txt" 2>/dev/null || true
  timeout 25s adb shell uiautomator dump /sdcard/inkr-ui.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/inkr-ui.xml > "$OUT/ui.xml" 2>/dev/null || true
  adb exec-out screencap -p > "$OUT/screenshot.png" 2>/dev/null || true
}
trap on_exit EXIT

test -s "$APK" || { echo "::error::Release APK missing: $APK"; exit 1; }
echo "APK size: $(stat -c %s "$APK") bytes"
adb install -r "$APK"
adb shell pm path "$PACKAGE" | grep -F "$PACKAGE"

# Confirm native manifest registers our deep-link URI without actually signing in.
adb shell dumpsys package "$PACKAGE" > "$OUT/package.txt"
if ! grep -q "inkr" "$OUT/package.txt"; then
  echo "::error::The native Android package has no INKR deep-link scheme."
  exit 1
fi

launch_and_check() {
  local phase="$1"
  adb shell am force-stop "$PACKAGE"
  adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 > "$OUT/monkey-$phase.txt"
  local pid=""
  for attempt in $(seq 1 25); do
    pid="$(adb shell pidof "$PACKAGE" | tr -d '\r' || true)"
    if [[ -n "$pid" ]]; then break; fi
    sleep 1
  done
  if [[ -z "$pid" ]]; then
    echo "::error::INKR did not start on the Android emulator ($phase)."
    return 1
  fi
  sleep 12
  if ! adb shell pidof "$PACKAGE" >/dev/null 2>&1; then
    echo "::error::INKR crashed after startup ($phase)."
    return 1
  fi
  # Restrict the crash assertion to our package, not unrelated Android services.
  if adb logcat -d -b crash | grep -F -A12 "Process: $PACKAGE," | grep -q "FATAL EXCEPTION"; then
    echo "::error::INKR Android fatal exception detected ($phase)."
    return 1
  fi
  echo "::notice::INKR native startup $phase passed, pid=$pid."
}

adb logcat -c
launch_and_check fresh
launch_and_check cold_restart

# This step validates installed native startup only. The separate staging UI
# script validates public network data and safe deep-link error handling.
# Neither script performs a real PKCE login or an authenticated artist workflow.
echo "::notice::Android install + two launch checks passed without physical hardware."
