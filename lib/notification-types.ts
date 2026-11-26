/** Shared by the server feed and the top bar (client). */

/** Cookie holding when this browser last opened the bell (ms since epoch). */
export const NOTIFICATIONS_SEEN_COOKIE = "jtg_notif_seen";

export type NotificationKind = "request" | "quote" | "approved" | "changes" | "declined" | "job" | "invoice" | "payment" | "referral";

/** One step of the funnel, shown in the top bar's bell. */
export type ShellNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  href: string;
  /** ISO timestamp. */
  at: string;
};
