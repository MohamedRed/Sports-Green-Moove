#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP="$ROOT_DIR/ios/Sources/SportsGreenMooveApp"
TEST="$ROOT_DIR/tests/fixtures/ios-ride-chat-runtime"
BUILD=$(mktemp -d "${TMPDIR:-/tmp}/sgm-ride-chat-runtime.XXXXXX")
trap 'rm -rf "$BUILD"' EXIT
for module in FirebaseAuth FirebaseFirestore FirebaseFunctions; do
  source="$TEST/$module.swift"
  if [[ "$module" == FirebaseFunctions ]]; then source="$ROOT_DIR/tests/fixtures/ios-support-concurrency/FirebaseFunctions.swift"; fi
  swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors -emit-module -emit-library \
    -module-name "$module" "$source" -emit-module-path "$BUILD/$module.swiftmodule" -o "$BUILD/lib$module.dylib"
done
swiftc -swift-version 6 -strict-concurrency=complete -warnings-as-errors -I "$BUILD" -L "$BUILD" \
  -lFirebaseAuth -lFirebaseFirestore -lFirebaseFunctions \
  "$TEST/Context.swift" "$TEST/main.swift" \
  "$APP/TeamChatModels.swift" "$APP/TeamChatText.swift" "$APP/TeamChatWire.swift" \
  "$APP/RideChatIdentity.swift" "$APP/RideChatModels.swift" "$APP/RideChatWire.swift" \
  "$APP/RideChatDirectoryWire.swift" "$APP/RideChatMessageWire.swift" "$APP/RideChatSourcePolicy.swift" \
  "$APP/RideChatRequest.swift" "$APP/RideChatCallbackClock.swift" \
  "$APP/FirebaseRideChatSnapshots.swift" "$APP/FirebaseRideChatGateway.swift" \
  "$APP/FirebaseRideChatThreadWatch.swift" "$APP/FirebaseRideChatInboxWatch.swift" -o "$BUILD/check"
DYLD_LIBRARY_PATH="$BUILD" "$BUILD/check"
