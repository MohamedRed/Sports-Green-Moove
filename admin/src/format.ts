import type { Timestamp } from "firebase/firestore";

export function formatDate(value: unknown): string {
  if (!value) return "n/a";
  if (typeof value === "string") return value.slice(0, 16).replace("T", " ");
  if (typeof value === "number") return new Date(value).toLocaleString("fr-BE");
  const timestamp = value as Partial<Timestamp>;
  if (typeof timestamp.toDate === "function") return timestamp.toDate().toLocaleString("fr-BE");
  return "n/a";
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function textValue(value: unknown, fallback = "n/a"): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function statusTone(status: unknown): "ok" | "warning" | "review" {
  if (status === "active" || status === "published" || status === "paid" || status === "closed") return "ok";
  if (status === "requested" || status === "open" || status === "pending") return "review";
  return "warning";
}
