import { searchFieldMasks, searchQueries } from '../../scripts/qa/search-maps-policy.mjs';

export const testKey = 'AIza' + 'unit_only_not_a_credential';
export const fixture = () => ({ origin: { lat: 50.71, lng: 4.60 }, destination: { lat: 50.85, lng: 4.35 },
  departureAt: new Date(Date.now() + 72 * 3600_000).toISOString() });
const details = [{ lat: 50.715, lng: 4.605 }, { lat: 50.846, lng: 4.357 }];
const point = p => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
export function request(index, trip) {
  const operations = ['autocomplete', 'place-details', 'autocomplete', 'place-details', 'route-matrix', 'compute-route'];
  const operation = operations[index];
  let url, body;
  if (operation === 'autocomplete') {
    url = 'https://places.googleapis.com/v1/places:autocomplete';
    body = { input: searchQueries[index / 2], includedRegionCodes: ['be'], languageCode: 'fr-BE' };
  } else if (operation === 'place-details') url = `https://places.googleapis.com/v1/places/place${(index + 1) / 2}`;
  else {
    const common = { travelMode: 'DRIVE', routingPreference: 'TRAFFIC_AWARE', units: 'METRIC', departureTime: trip.departureAt };
    if (operation === 'route-matrix') {
      url = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
      body = { origins: [trip.origin, ...details].map(p => ({ waypoint: point(p) })),
        destinations: [...details, trip.destination].map(p => ({ waypoint: point(p) })), ...common };
    } else {
      url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
      body = { origin: point(trip.origin), destination: point(trip.destination), intermediates: details.map(point), ...common };
    }
  }
  return { url, method: operation === 'place-details' ? 'GET' : 'POST', body: body ? JSON.stringify(body) : null,
    fieldMask: searchFieldMasks[operation] };
}
export function response(index) {
  let json;
  if (index === 0 || index === 2) json = { suggestions: [{ placePrediction: { placeId: `place${index / 2 + 1}` } }] };
  else if (index === 1 || index === 3) {
    const p = details[(index - 1) / 2];
    json = { id: `place${(index + 1) / 2}`, location: { latitude: p.lat, longitude: p.lng } };
  } else if (index === 4) json = Array.from({ length: 9 }, (_, n) => ({ originIndex: Math.floor(n / 3),
    destinationIndex: n % 3, distanceMeters: 1000 + n, duration: '100s', condition: 'ROUTE_EXISTS', status: {} }));
  else json = { routes: [{ distanceMeters: 20000, duration: '1800s', polyline: { encodedPolyline: 'unit-only-route' } }] };
  return new Response(JSON.stringify(json), { status: 200 });
}
export function init(data) {
  return { method: data.method, ...(data.body === null ? {} : { body: data.body }),
    headers: { 'X-Goog-Api-Key': testKey, 'X-Goog-FieldMask': data.fieldMask } };
}
