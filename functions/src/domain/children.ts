import type { ChildAccessDocument } from "./searchAccess.js";

export type ChildProfileDocument = {
  displayName?: unknown;
  firstName?: unknown;
  name?: unknown;
  teamName?: unknown;
} & ChildAccessDocument;

export function childDisplayLabel(child: ChildProfileDocument | undefined, childId: string): string {
  const label = stringValue(child?.displayName) ?? stringValue(child?.name) ?? stringValue(child?.firstName);
  return label ?? `Enfant ${childId.slice(-4).toUpperCase()}`;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
