export function hasGeographicCoordinates(value: unknown): value is Record<string, unknown> & { lat: number; lng: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return typeof point.lat === "number" && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
    typeof point.lng === "number" && Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
}
