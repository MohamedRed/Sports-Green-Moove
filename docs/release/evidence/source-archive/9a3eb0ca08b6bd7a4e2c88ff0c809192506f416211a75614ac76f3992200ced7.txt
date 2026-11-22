export const membershipCursorMaxLength = 16_384;

export function membershipPageToken(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value.length || value.length > membershipCursorMaxLength || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Page de liste invalide.");
  }
  return value;
}
