import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
test('profile row uses the saved city and not an options navigation or fixed city', () => {
  const settings = source('android/app/src/main/java/be/sportgreenmoove/app/ui/ProfileSettingsCard.kt');
  assert.match(settings, /"Ma ville", cityLabel, onCity/); assert(!settings.includes('Wavre, Belgique'));
  assert.match(source('android/app/src/main/java/be/sportgreenmoove/app/ui/ProfileRoute.kt'), /ProfileCityHost\(uid, cityGateway\)/);
  assert.match(source('android/app/src/main/java/be/sportgreenmoove/app/ui/SportsGreenMooveApp.kt'), /cityGateway = providers.profileCity/);
});
test('profile city stays independent of trip search and publication', () => {
  for (const file of ['SearchController.kt', 'SearchFormState.kt', 'PublishController.kt']) {
    const text = source('android/app/src/main/java/be/sportgreenmoove/app/ui/' + file);
    assert(!/ProfileCity|profileCity|cityGateway|profileCities/.test(text), file);
  }
  const service = source('functions/src/services/profileCity.ts');
  assert.deepEqual([...service.matchAll(/collection\("([^"]+)"\)/g)].map(match => match[1]), ['profileCities', 'profileCities']);
});
test('city gateway fences the current account before and after the callable', () => {
  const gateway = source('android/app/src/main/java/be/sportgreenmoove/app/services/FirebaseAndroidProfileCityGateway.kt');
  assert.match(gateway, /requireSession\(uid\)[\s\S]*\.await\(\)[\s\S]*requireSession\(uid\)/);
  assert.match(gateway, /data\["userId"\] == uid/);
  const host = source('android/app/src/main/java/be/sportgreenmoove/app/ui/ProfileCityHost.kt');
  assert.match(host, /key\(uid, gateway\)/); assert.match(host, /onDispose \{ state.close\(\) \}/);
});
test('authenticated isolated service checks are required in web smoke', () => {
  const workflow = source('.github/workflows/web-integration-smoke.yml');
  assert.match(workflow, /node scripts\/qa\/run-profile-city-services.mjs && node --test tests\/profile-city-contract.test.mjs/);
  const runner = source('scripts/qa/run-profile-city-services.mjs');
  assert.match(runner, /checks.length, 10/); assert.match(runner, /assertLocalEndpointsClosed/);
});
