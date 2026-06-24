#!/usr/bin/env bash
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/.hermes/android-sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
OUT="${SGM_QA_EVIDENCE_DIR:-$HOME/.hermes/android-qa-evidence/sgm/emulator-fixture/role-flow}"
mkdir -p "$OUT"

capture() {
  local name="$1"
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/window.xml > "$OUT/${name}.xml" || true
  adb exec-out screencap -p > "$OUT/${name}.png"
}

wait_text() {
  local regex="$1" name="$2" max="${3:-60}"
  for i in $(seq 1 "$max"); do
    adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
    adb exec-out cat /sdcard/window.xml > "$OUT/${name}.xml" || true
    if grep -Eiq "Pixel Launcher isn't responding|System UI isn't responding" "$OUT/${name}.xml"; then
      # System/launcher ANRs can cover the app on constrained headless emulators.
      # Close only the system dialog; the app under test remains running.
      adb shell input tap 540 1235 || true
      sleep 2
      continue
    fi
    if grep -Eiq "isn't responding|not responding|responding" "$OUT/${name}.xml"; then
      # If the app itself shows an ANR, preserve it as a real blocker instead of hiding it.
      adb exec-out screencap -p > "$OUT/${name}.png"
      echo "ANR dialog observed for $name" >&2
      return 1
    fi
    if grep -Eiq "$regex" "$OUT/${name}.xml"; then
      adb exec-out screencap -p > "$OUT/${name}.png"
      echo "matched $regex at poll $i for $name"
      return 0
    fi
    sleep 2
  done
  adb exec-out screencap -p > "$OUT/${name}.png" || true
  echo "timeout waiting for $regex for $name" >&2
  return 1
}

type_email() {
  local local_part="$1"
  adb shell input text "$local_part"
  sleep .5
  adb shell input keyevent 77
  sleep .5
  adb shell input text 'example.test'
  sleep .8
}

login_as() {
  local local_part="$1" role="$2"
  adb shell pm clear be.sportgreenmoove.app >/dev/null
  adb logcat -c
  adb shell am start -W -n be.sportgreenmoove.app/.MainActivity > "$OUT/${role}_start.txt" || true
  wait_text 'SE CONNECTER' "${role}_01_login_ready" 90
  adb shell input tap 220 875
  sleep .4
  type_email "$local_part"
  sleep .4
  adb shell input tap 220 1025
  sleep .4
  adb shell input text 'QaPass12345'
  sleep .8
  adb shell input keyevent KEYCODE_BACK || true
  sleep .8
  capture "${role}_02_filled_credentials"
  adb shell input tap 540 1185
  wait_text 'Accueil|Trajets|Profil|Bonjour' "${role}_03_after_login" 90
  if grep -Eiq 'Connexion impossible|E-mail ou mot de passe|adresse e-mail valide' "$OUT/${role}_03_after_login.xml"; then
    echo "login failed for $role" >&2
    return 1
  fi
  adb logcat -d > "$OUT/${role}_03_after_login.logcat"
}

adb wait-for-device
adb uninstall be.sportgreenmoove.app >/dev/null 2>&1 || true
adb install "$APK" >/dev/null
adb shell settings put global window_animation_scale 0 >/dev/null 2>&1 || true
adb shell settings put global transition_animation_scale 0 >/dev/null 2>&1 || true
adb shell settings put global animator_duration_scale 0 >/dev/null 2>&1 || true

login_as p parent
# Bottom navigation on authenticated parent fixture.
adb shell input tap 335 2220; sleep 7; capture parent_04_trips
adb shell input tap 540 2220; sleep 7; capture parent_05_publish_or_blocker
adb shell input tap 745 2220; sleep 7; capture parent_06_messages
adb shell input tap 950 2220; sleep 7; capture parent_07_profile

login_as d driver
adb shell input tap 540 2220; sleep 10; capture driver_04_publish
adb shell input tap 335 2220; sleep 7; capture driver_05_trips
adb logcat -d > "$OUT/driver_final.logcat"

python3 - <<PY
from pathlib import Path
import xml.etree.ElementTree as ET
out=Path('$OUT')
for xml in sorted(out.glob('*.xml')):
    texts=[]
    try:
        root=ET.parse(xml).getroot()
        for node in root.iter('node'):
            text=node.attrib.get('text') or node.attrib.get('content-desc')
            if text: texts.append(text.replace('\n',' / '))
    except Exception as exc:
        texts=[f'PARSE_ERROR {exc}']
    print(f'## {xml.name}')
    for text in texts[:35]: print(text)
PY
