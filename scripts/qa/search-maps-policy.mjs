import assert from 'node:assert/strict';
import { mapsOperation } from './real-maps-fetch.mjs';

export const searchMapsPolicy = 'approved-parent-search-eight-requests';
export const searchMapsRequestLimit = 8;
export const searchQueries = ['Gare de Wavre', 'Gare de Bruxelles-Central'];
export const searchOperations = ['autocomplete', 'place-details', 'autocomplete', 'place-details', 'route-matrix', 'compute-route'];
export const searchFieldMasks = {
  autocomplete: 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
  'place-details': 'id,formattedAddress,displayName,location',
  'route-matrix': 'originIndex,destinationIndex,status,condition,distanceMeters,duration',
  'compute-route': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
};

export function searchMapsOperation(target, init) {
  const url = new URL(target);
  if (url.href === 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix' && init?.method === 'POST')
    return 'route-matrix';
  return mapsOperation(target, init);
}

export function assertSearchFixture(fixture) {
  assert.deepEqual(Object.keys(fixture).sort(), ['departureAt', 'destination', 'origin']);
  for (const point of [fixture.origin, fixture.destination]) assertBelgianPoint(point);
  assert(Number.isFinite(Date.parse(fixture.departureAt)) && Date.parse(fixture.departureAt) > Date.now());
}

export function assertBelgianPoint(point) {
  assert.deepEqual(Object.keys(point).sort(), ['lat', 'lng']);
  assert(Number.isFinite(point.lat) && point.lat >= 49.4 && point.lat <= 51.6);
  assert(Number.isFinite(point.lng) && point.lng >= 2.4 && point.lng <= 6.5);
}

const routePoint = point => ({ location: { latLng: { latitude: point.lat, longitude: point.lng } } });
const matrixPoint = point => ({ waypoint: routePoint(point) });
const samePoint = (a, b) => Math.abs(a.lat - b.lat) < 0.000001 && Math.abs(a.lng - b.lng) < 0.000001;

export function assertSearchMapPayload({ target, init, operation, index, fixture, selected, details }) {
  assert.equal(operation, searchOperations[index], 'Only the approved one-candidate search chain is allowed');
  const headers = new Headers(init.headers);
  assert.equal(headers.get('X-Goog-FieldMask'), searchFieldMasks[operation]);
  if (operation === 'place-details') {
    assert(init.body === undefined || init.body === null);
    assert.equal(new URL(target).pathname, '/v1/places/' + selected.at(-1));
    return;
  }
  const body = JSON.parse(init.body);
  if (operation === 'autocomplete') {
    assert.deepEqual(body, { input: searchQueries[index / 2], includedRegionCodes: ['be'], languageCode: 'fr-BE' });
    return;
  }
  assert.equal(details.length, 2);
  const [pickup, dropoff] = details;
  const common = { travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', units: 'METRIC', departureTime: fixture.departureAt };
  assert(Date.parse(common.departureTime) > Date.now(), 'The isolated departure must still be in the future');
  if (operation === 'route-matrix') {
    assert.deepEqual(body, { origins: [fixture.origin, pickup, dropoff].map(matrixPoint),
      destinations: [pickup, dropoff, fixture.destination].map(matrixPoint), ...common });
  } else {
    const intermediates = [pickup, dropoff]
      .filter(point => !samePoint(point, fixture.origin) && !samePoint(point, fixture.destination))
      .filter((point, index, points) => index === 0 || !samePoint(point, points[index - 1])).map(routePoint);
    assert.deepEqual(body, { origin: routePoint(fixture.origin), destination: routePoint(fixture.destination),
      ...(intermediates.length ? { intermediates } : {}), ...common });
  }
}
