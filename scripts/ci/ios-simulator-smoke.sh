#!/usr/bin/env bash
set -Eeuo pipefail

# Staging-only, credentials-free iOS simulator smoke. No production mutation.
BUNDLE_ID="com.inkr.tattoo"
SIMULATOR_ID="${1:?Usage: ios-simulator-smoke.sh <simulator-udid> <INKR.app>}"
APP_PATH="${2:?Missing simulator .app path}"
OUT="${RUNNER_TEMP:-/tmp}/inkr-ios-smoke"
mkdir -p "$OUT"

collect_evidence() {
  xcrun simctl io "$SIMULATOR_ID" screenshot "$OUT/final.png" >/dev/null 2>&1 || true
  xcrun simctl spawn "$SIMULATOR_ID" log show --last 4m --style compact \
    --predicate 'process == "INKR" OR process == "SpringBoard" OR process == "ReportCrash"' \
    > "$OUT/simulator-app-log.txt" 2>&1 || true
  local diagnostics="$HOME/Library/Developer/CoreSimulator/Devices/$SIMULATOR_ID/data/Library/Logs/DiagnosticReports"
  if [[ -d "$diagnostics" ]]; then
    find "$diagnostics" -maxdepth 1 -type f \( -iname '*INKR*.ips' -o -iname '*INKR*.crash' \) \
      -print -exec cp {} "$OUT/" \; 2>/dev/null || true
  fi
}
trap collect_evidence EXIT

app_alive() {
  local label="$1"
  # Simulator app processes are visible via launchctl and/or ps, depending on runtime.
  if ! (xcrun simctl spawn "$SIMULATOR_ID" launchctl list | grep -Fq "$BUNDLE_ID" ||
        xcrun simctl spawn "$SIMULATOR_ID" /bin/ps -A -o comm= | grep -Eq '(/|^)INKR$'); then
    echo "::error::INKR process not running after $label."
    return 1
  fi
  echo "::notice::INKR process alive after $label."
}

capture() {
  xcrun simctl io "$SIMULATOR_ID" screenshot "$OUT/$1.png"
}

xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true
xcrun simctl bootstatus "$SIMULATOR_ID" -b
xcrun simctl install "$SIMULATOR_ID" "$APP_PATH"
xcrun simctl get_app_container "$SIMULATOR_ID" "$BUNDLE_ID" app > "$OUT/app-install-path.txt"

xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID" | tee "$OUT/first-launch.txt"
sleep 12
app_alive "first launch"
capture "first-launch"

# Cold relaunch: terminate the installed app, not the simulator.
xcrun simctl terminate "$SIMULATOR_ID" "$BUNDLE_ID"
xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID" | tee "$OUT/cold-relaunch.txt"
sleep 6
app_alive "cold relaunch"
capture "cold-relaunch"

# Exercise URL dispatch using an invalid auth callback; no credentials or OTP.
xcrun simctl openurl "$SIMULATOR_ID" "inkr://auth/callback?error=access_denied"
sleep 5
app_alive "invalid auth deep link"
capture "invalid-auth-link"

# Put the app in the background and bring it to the foreground.
xcrun simctl launch "$SIMULATOR_ID" com.apple.mobilesafari > "$OUT/background-safari.txt"
sleep 3
xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID" > "$OUT/foreground-return.txt"
sleep 5
app_alive "foreground return"
capture "foreground-return"

collect_evidence
if find "$OUT" -maxdepth 1 -type f \( -name '*INKR*.ips' -o -name '*INKR*.crash' \) | grep -q .; then
  echo "::error::An INKR simulator native crash report was generated; inspect artifact."
  exit 1
fi

echo "::notice::INKR iOS simulator installation, relaunch, invalid auth deep link and background/foreground passed."
