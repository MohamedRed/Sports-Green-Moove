#!/usr/bin/env bash
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/.hermes/android-sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
OUT="${SGM_QA_EVIDENCE_DIR:-$HOME/.hermes/android-qa-evidence/sgm/emulator-fixture/emulators-exec-login}"
mkdir -p "$OUT"

adb wait-for-device
adb uninstall be.sportgreenmoove.app >/dev/null 2>&1 || true
adb install "$APK" >/dev/null
adb shell pm clear be.sportgreenmoove.app >/dev/null
adb shell settings put global window_animation_scale 0 >/dev/null 2>&1 || true
adb shell settings put global transition_animation_scale 0 >/dev/null 2>&1 || true
adb shell settings put global animator_duration_scale 0 >/dev/null 2>&1 || true
adb logcat -c
adb shell am start -W -n be.sportgreenmoove.app/.MainActivity > "$OUT/00_start.txt" || true

for i in $(seq 1 90); do
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/window.xml > "$OUT/01_wait_login.xml" || true
  if grep -q 'SE CONNECTER' "$OUT/01_wait_login.xml" && ! grep -qi 'responding' "$OUT/01_wait_login.xml"; then
    echo "login UI ready at poll $i"
    break
  fi
  sleep 2
done
adb exec-out screencap -p > "$OUT/01_login_ready.png"

adb shell input tap 220 875
sleep .4
adb shell input text 'p'
adb shell input keyevent 77
adb shell input text 'example.test'
sleep .4
adb shell input tap 220 1025
sleep .4
adb shell input text 'QaPass12345'
sleep .8
adb shell input keyevent KEYCODE_BACK || true
sleep .8
adb exec-out screencap -p > "$OUT/02_filled_credentials.png"
adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
adb exec-out cat /sdcard/window.xml > "$OUT/02_filled_credentials.xml" || true

adb shell input tap 540 1185
for i in $(seq 1 60); do
  adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/window.xml > "$OUT/03_after_submit.xml" || true
  if grep -Eiq 'Accueil|Trajets|Publier|Profil|Messages|Connexion impossible|E-mail ou mot de passe|adresse e-mail valide|responding' "$OUT/03_after_submit.xml"; then
    if ! grep -q 'SE CONNECTER' "$OUT/03_after_submit.xml" || grep -Eiq 'Connexion impossible|E-mail ou mot de passe|adresse e-mail valide|responding' "$OUT/03_after_submit.xml"; then
      break
    fi
  fi
  sleep 2
done
adb exec-out screencap -p > "$OUT/03_after_submit.png"
adb logcat -d > "$OUT/03_after_submit.logcat"

python3 - <<PY
import xml.etree.ElementTree as ET
p='$OUT/03_after_submit.xml'
root=ET.parse(p).getroot()
print('VISIBLE_TEXT_BEGIN')
for n in root.iter('node'):
    t=n.attrib.get('text') or n.attrib.get('content-desc')
    if t:
        print(repr(t), n.attrib.get('bounds'))
print('VISIBLE_TEXT_END')
PY

grep -Ei 'SGM\.FirebaseEmulator|FirebaseAuth|initializeUserProfile|Recaptcha|Cleartext|FirebaseFunctions|Functions|OkHttp|PERMISSION_DENIED|UNAUTHENTICATED|ConnectException|UnknownHost|DEADLINE|timeout|Exception|FATAL' "$OUT/03_after_submit.logcat" | tail -220 || true
