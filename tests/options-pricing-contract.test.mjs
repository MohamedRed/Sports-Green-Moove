import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const android = 'android/app/src/main/java/be/sportgreenmoove/app/ui/OptionsScreen.kt';
for (const path of [android, 'ios/Sources/SportsGreenMooveApp/OptionsScreen.swift'])
  test(`${path}: options do not advertise an undecided commission as a confirmed zero rate`, () => {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /Frais plateforme|0 EUR|En attente des conditions business/);
  });
test('removing the placeholder preserves working account controls', () => {
  const options = readFileSync(android, 'utf8');
  for (const control of ['NotificationSettingsRow()', 'OptionsReportCard(uid, firebase)',
    '"options.emergency"', '"options.support-history"']) assert(options.includes(control), control);
});
