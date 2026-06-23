#!/usr/bin/env bash
# Build Nexa iOS release IPA on macOS CI (GitHub Actions). Requires signing env vars.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${APPLE_TEAM_ID:?APPLE_TEAM_ID is required}"
: "${IOS_BUNDLE_ID:=com.loopc.nexa}"

echo "==> Prebuild iOS native project"
npx expo prebuild --platform ios --non-interactive

WORKSPACE="$(find ios -maxdepth 1 -name '*.xcworkspace' | head -n 1)"
if [[ -z "$WORKSPACE" ]]; then
  echo "No .xcworkspace found under ios/"
  exit 1
fi
SCHEME="$(basename "$WORKSPACE" .xcworkspace)"
echo "Using workspace=$WORKSPACE scheme=$SCHEME"

echo "==> CocoaPods"
cd ios
pod install --repo-update
cd "$ROOT"

ARCHIVE_PATH="$ROOT/build/Nexa.xcarchive"
EXPORT_PATH="$ROOT/build/export"
IPA_PATH="$EXPORT_PATH/Nexa.ipa"
mkdir -p "$ROOT/build"

echo "==> xcodebuild archive"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination 'generic/platform=iOS' \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  PRODUCT_BUNDLE_IDENTIFIER="$IOS_BUNDLE_ID" \
  archive

echo "==> xcodebuild exportArchive"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$ROOT/scripts/ios-export-options.plist"

if [[ ! -f "$IPA_PATH" ]]; then
  FOUND="$(find "$EXPORT_PATH" -maxdepth 1 -name '*.ipa' | head -n 1)"
  if [[ -n "$FOUND" ]]; then
    cp "$FOUND" "$IPA_PATH"
  else
    echo "IPA not found in $EXPORT_PATH"
    exit 1
  fi
fi

echo "IPA ready: $IPA_PATH"
