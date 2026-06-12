export type ClientInboxSummary = {
  notifications: ClientInboxNotification[];
  chats: ClientInboxChat[];
  reviews: ClientInboxReviewPrompt[];
};

export type ClientInboxNotification = {
  id: string;
  title: string;
  body: string;
  dateLabel: string;
  unread: boolean;
  initials: string;
};

export type ClientInboxChat = {
  id: string;
  sourceType: "booking" | "rideSession";
  sourceId: string;
  title: string;
  preview: string;
  dateLabel: string;
  unreadCount: number;
  initials: string;
};

export type ClientInboxReviewPrompt = {
  id: string;
  rideSessionId: string;
  ratedUserId: string;
  title: string;
  prompt: string;
  initials: string;
};

export type InboxDocument<T extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  data: T;
};

type NotificationDocument = {
  title?: unknown;
  body?: unknown;
  read?: unknown;
  createdAt?: unknown;
};

type MessageDocument = {
  sourceType?: unknown;
  sourceId?: unknown;
  senderUserId?: unknown;
  body?: unknown;
  readByUserIds?: unknown;
  createdAt?: unknown;
};

type RideDocument = {
  driverUserId?: unknown;
  participantUserIds?: unknown;
  status?: unknown;
};

export function mapInboxNotifications(
  notifications: readonly InboxDocument<NotificationDocument>[],
): ClientInboxNotification[] {
  return notifications.map((notification) => {
    const title = stringValue(notification.data.title) ?? "Notification";
    return {
      id: notification.id,
      title,
      body: stringValue(notification.data.body) ?? "",
      dateLabel: dateLabel(notification.data.createdAt),
      unread: notification.data.read !== true,
      initials: initials(title),
    };
  });
}

export function buildInboxChats(
  messages: readonly InboxDocument<MessageDocument>[],
  currentUserId: string,
): ClientInboxChat[] {
  const grouped = new Map<string, InboxDocument<MessageDocument>[]>();
  for (const message of messages) {
    const sourceType = sourceTypeValue(message.data.sourceType);
    const sourceId = stringValue(message.data.sourceId);
    if (!sourceType || !sourceId) continue;
    const key = `${sourceType}:${sourceId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), message]);
  }

  return [...grouped.entries()]
    .map(([key, group]) => {
      const latest = [...group].sort((a, b) => millis(b.data.createdAt) - millis(a.data.createdAt))[0];
      const sourceType = sourceTypeValue(latest.data.sourceType) ?? "booking";
      const sourceId = stringValue(latest.data.sourceId) ?? key;
      const title = sourceType === "booking" ? "Conversation réservation" : "Conversation course";
      return {
        id: key,
        sourceType,
        sourceId,
        title,
        preview: stringValue(latest.data.body) ?? "",
        dateLabel: dateLabel(latest.data.createdAt),
        unreadCount: group.filter((message) => isUnreadFor(message.data, currentUserId)).length,
        initials: initials(title),
      };
    })
    .sort((a, b) => latestMillis(messages, b.id) - latestMillis(messages, a.id));
}

export function buildInboxReviewPrompts(
  rides: readonly InboxDocument<RideDocument>[],
  authoredRatingIds: ReadonlySet<string>,
  currentUserId: string,
): ClientInboxReviewPrompt[] {
  return rides.flatMap((ride) => {
    if (ride.data.status !== "completed") return [];
    const ratedUserId = reviewTargetUserId(ride.data, currentUserId);
    if (!ratedUserId) return [];
    const ratingId = `${ride.id}_${currentUserId}_${ratedUserId}`;
    if (authoredRatingIds.has(ratingId)) return [];
    const title = "Avis de course";
    return [{
      id: ratingId,
      rideSessionId: ride.id,
      ratedUserId,
      title,
      prompt: "Comment s'est passé votre trajet? Donnez votre avis.",
      initials: initials(title),
    }];
  });
}

function reviewTargetUserId(ride: RideDocument, currentUserId: string): string | undefined {
  const driverUserId = stringValue(ride.driverUserId);
  const participants = stringArray(ride.participantUserIds).filter((userId) => userId !== currentUserId);
  if (driverUserId && driverUserId !== currentUserId) return driverUserId;
  return participants[0];
}

function isUnreadFor(message: MessageDocument, currentUserId: string): boolean {
  if (stringValue(message.senderUserId) === currentUserId) return false;
  return !stringArray(message.readByUserIds).includes(currentUserId);
}

function latestMillis(messages: readonly InboxDocument<MessageDocument>[], key: string): number {
  return Math.max(
    0,
    ...messages
      .filter((message) => `${sourceTypeValue(message.data.sourceType)}:${stringValue(message.data.sourceId)}` === key)
      .map((message) => millis(message.data.createdAt)),
  );
}

function sourceTypeValue(value: unknown): "booking" | "rideSession" | undefined {
  return value === "booking" || value === "rideSession" ? value : undefined;
}

function initials(value: string): string {
  const parts = value.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2)).toUpperCase();
}

function dateLabel(value: unknown): string {
  const date = new Date(millis(value) || Date.now());
  return new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date).replaceAll("/", "-");
}

function millis(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
