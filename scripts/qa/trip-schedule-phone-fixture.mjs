import { tripScheduleFixtureTimes } from './trip-change-schedule-evidence.mjs';

export function tripSchedulePhoneFixture(now = Date.now()) {
  const times = tripScheduleFixtureTimes(now);
  return { originalDepartureAt: times.originalDepartureAt,
    draftDepartureAt: new Date(Date.parse(times.proposedDepartureAt) + 2 * 3600_000).toISOString(),
    draftArrivalBy: new Date(Date.parse(times.desiredArrivalBy) + 2 * 3600_000).toISOString() };
}
