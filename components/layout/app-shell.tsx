"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Box,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  Clock,
  CreditCard,
  FileText,
  Hammer,
  House,
  Inbox,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ThumbsUp,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { CompleteVisitHost } from "@/components/jobs/complete-visit-dialog";
import { ShellHeaderProvider } from "@/components/layout/shell-header";
import { Avatar } from "@/components/team/team-ui";
import { cn } from "@/lib/cn";
import type { ShellAlert, ShellProfile } from "@/lib/shell";
import { NOTIFICATIONS_SEEN_COOKIE, type NotificationKind, type ShellNotification } from "@/lib/notification-types";

type NavItem = { href: string; label: string; icon: typeof House; exact?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: House, exact: true },
  { href: "/agenda", label: "Schedule", icon: CalendarDays },
  { href: "/clientes", label: "Clients", icon: Users },
  { href: "/solicitacoes", label: "Requests", icon: Inbox },
  { href: "/cotacoes", label: "Quotes", icon: FileText },
  { href: "/servicos", label: "Jobs", icon: Hammer },
  { href: "/faturas", label: "Invoices", icon: ReceiptText },
  { href: "/pagamentos", label: "Payments", icon: CreditCard },
];

// Configuration, outside the funnel.
const NAV_CONFIG: NavItem[] = [
  { href: "/produtos-servicos", label: "Products & Services", icon: Box },
  { href: "/equipa", label: "Team", icon: UserRound },
  { href: "/horas", label: "Timesheets", icon: Clock },
  { href: "/despesas", label: "Expenses", icon: Wallet },
  { href: "/relatorios", label: "Reports", icon: ChartColumn },
];

const NAV_SETTINGS: NavItem[] = [{ href: "/configuracoes/email", label: "Settings", icon: Settings }];

const CREATE_ITEMS = [
  { label: "Client", href: "/clientes/novo", icon: Users },
  { label: "Request", href: "/solicitacoes/novo", icon: Inbox },
  { label: "Quote", href: "/cotacoes/novo", icon: FileText },
  { label: "Job", href: "/servicos/novo", icon: Hammer },
  { label: "Invoice", href: "/faturas/novo", icon: ReceiptText },
];

/** Closes a popover on a click outside the element carrying `attr`. */
function useOutsideClose(open: boolean, attr: string, close: () => void) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest(`[${attr}]`)) return;
      close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, attr, close]);
}

const NOTIFICATION_STYLE: Record<NotificationKind, { icon: typeof House; tone: string }> = {
  request: { icon: Inbox, tone: "bg-sky-50 text-sky-700" },
  quote: { icon: FileText, tone: "bg-amber-50 text-amber-700" },
  approved: { icon: ThumbsUp, tone: "bg-emerald-50 text-emerald-700" },
  changes: { icon: MessageSquare, tone: "bg-sky-50 text-sky-700" },
  declined: { icon: X, tone: "bg-rose-50 text-rose-700" },
  job: { icon: Hammer, tone: "bg-violet-50 text-violet-700" },
  invoice: { icon: ReceiptText, tone: "bg-slate-100 text-slate-700" },
  payment: { icon: Wallet, tone: "bg-emerald-50 text-emerald-700" },
  referral: { icon: UserRound, tone: "bg-amber-50 text-amber-700" },
};

function timeAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Bell feed and counts, refreshed every minute and whenever the bell opens. */
function useNotifications(initial: { notifications: ShellNotification[]; alerts: ShellAlert[]; seenAt: number }) {
  const [data, setData] = useState({ notifications: initial.notifications, alerts: initial.alerts });
  const [seenAt, setSeenAt] = useState(initial.seenAt);

  // A server render (navigation, router.refresh) brings newer data.
  useEffect(() => {
    setData({ notifications: initial.notifications, alerts: initial.alerts });
  }, [initial.notifications, initial.alerts]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { notifications: ShellNotification[]; alerts: ShellAlert[] };
      setData({ notifications: body.notifications, alerts: body.alerts });
    } catch {
      // Offline or signed out: keep what is on screen.
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 60_000);
    const onVisible = () => document.visibilityState === "visible" && void reload();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  const markSeen = useCallback(() => {
    const now = Date.now();
    setSeenAt(now);
    document.cookie = `${NOTIFICATIONS_SEEN_COOKIE}=${now}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const unread = data.notifications.filter((n) => Date.parse(n.at) > seenAt).length;
  return { ...data, seenAt, unread, reload, markSeen };
}

export function AppShell({
  children,
  email,
  profile,
  alerts: initialAlerts,
  notifications: initialNotifications,
  seenAt: initialSeenAt,
}: {
  children: React.ReactNode;
  email: string;
  profile: ShellProfile;
  alerts: ShellAlert[];
  notifications: ShellNotification[];
  seenAt: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isSchedule = pathname.startsWith("/agenda");
  const [createOpen, setCreateOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const bell = useNotifications({ notifications: initialNotifications, alerts: initialAlerts, seenAt: initialSeenAt });
  const alerts = bell.alerts;
  const attention = alerts.reduce((s, a) => s + a.count, 0);
  // When the bell opened: items newer than the previous visit keep their dot until it closes.
  const [openedSeenAt, setOpenedSeenAt] = useState(0);
  const [now, setNow] = useState(0);
  // Detail pages (request, quote, job) put their title and buttons in the top bar.
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);
  const [pageHeaders, setPageHeaders] = useState(0);
  const hasPageHeader = pageHeaders > 0;
  const shellHeader = useMemo(
    () => ({
      slot: headerSlot,
      register: () => {
        setPageHeaders((n) => n + 1);
        return () => setPageHeaders((n) => n - 1);
      },
    }),
    [headerSlot],
  );

  function toggleBell() {
    if (bellOpen) {
      setBellOpen(false);
      return;
    }
    setOpenedSeenAt(bell.seenAt);
    setNow(Date.now());
    setBellOpen(true);
    bell.markSeen();
    void bell.reload();
  }

  useOutsideClose(createOpen, "data-create-menu", () => setCreateOpen(false));
  useOutsideClose(bellOpen, "data-bell-menu", () => setBellOpen(false));
  useOutsideClose(userOpen, "data-user-menu", () => setUserOpen(false));

  // "/" focuses the search box, as in Jobber.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input,textarea,select,[contenteditable=true]")) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navLink = (item: NavItem) => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    return (
      <Link
        key={item.label}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-11 items-center gap-3.5 rounded-xl px-3.5 text-[15px] transition-colors",
          active
            ? "bg-[#e8effc] font-semibold text-slate-900"
            : "font-medium text-slate-600 hover:bg-white hover:text-slate-900",
        )}
      >
        <item.icon size={20} strokeWidth={1.75} className={active ? "text-[#1d4ed8]" : "text-slate-500"} />
        {item.label}
      </Link>
    );
  };

  const logo = (
    <Link href="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#13213d] text-lg font-extrabold text-white">
        J
      </span>
      <span className="hidden text-xl font-bold tracking-tight text-slate-900 min-[420px]:inline lg:inline">Job To Go</span>
    </Link>
  );

  const sidebar = (
    <div className="flex h-full flex-col px-4 pb-5">
      <div className="flex h-[76px] shrink-0 items-center px-1">{logo}</div>
      <div className="relative mt-3" data-create-menu>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          aria-expanded={createOpen}
          aria-haspopup="menu"
          className="flex h-11 w-full items-center gap-3.5 rounded-xl bg-[#13213d] px-3.5 text-[15px] font-semibold text-white hover:bg-[#1e3a5f]"
        >
          {createOpen ? <X size={20} strokeWidth={2} /> : <Plus size={20} strokeWidth={2} />}
          Create
        </button>
        {createOpen ? (
          <div role="menu" className="absolute inset-x-0 top-12 z-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            {CREATE_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                onClick={() => {
                  setCreateOpen(false);
                  setMobileOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <item.icon size={17} className="text-slate-500" />
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
      <nav className="mt-3 flex flex-col gap-1" aria-label="Main navigation">
        {NAV.map(navLink)}
        <hr className="mx-1 my-3 border-slate-200" />
        {NAV_CONFIG.map(navLink)}
        <hr className="mx-1 my-3 border-slate-200" />
        {NAV_SETTINGS.map(navLink)}
      </nav>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] overflow-y-auto border-r border-slate-200/80 bg-[#f9fafc] lg:block">
        {sidebar}
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 bg-canvas/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:h-[76px] lg:px-6">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-700 hover:bg-white lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="lg:hidden">{logo}</div>

            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const q = query.trim();
                router.push(q ? `/clientes?q=${encodeURIComponent(q)}` : "/clientes");
              }}
              className={cn(
                "hidden h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-within:border-[#1d4ed8] sm:flex",
                hasPageHeader ? "w-[220px] shrink-0 2xl:w-[300px]" : "w-full max-w-[390px]",
              )}
            >
              <Search size={18} className="shrink-0 text-slate-500" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clients…"
                aria-label="Search clients"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </form>

            <div ref={setHeaderSlot} className={hasPageHeader ? "flex min-w-0 flex-1" : "hidden"} />

            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="relative" data-bell-menu>
                <button
                  type="button"
                  onClick={toggleBell}
                  aria-expanded={bellOpen}
                  aria-label={bell.unread ? `${bell.unread} new notifications` : "Notifications"}
                  className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-700 hover:bg-white"
                >
                  <Bell size={21} strokeWidth={1.75} />
                  {bell.unread ? (
                    <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-canvas">
                      {bell.unread > 9 ? "9+" : bell.unread}
                    </span>
                  ) : attention ? (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-canvas" />
                  ) : null}
                </button>
                {bellOpen ? (
                  <div className="absolute right-0 top-12 z-40 flex max-h-[min(640px,calc(100vh-6rem))] w-96 max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between px-4 pb-2 pt-3">
                      <p className="text-sm font-bold text-slate-900">Notifications</p>
                      <span className="text-xs text-slate-400">Last 30 days</span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                      {bell.notifications.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-slate-500">No activity yet.</p>
                      ) : (
                        bell.notifications.map((n) => {
                          const style = NOTIFICATION_STYLE[n.kind];
                          const Icon = style.icon;
                          const fresh = Date.parse(n.at) > openedSeenAt;
                          return (
                            <Link
                              key={n.id}
                              href={n.href}
                              onClick={() => setBellOpen(false)}
                              className={cn(
                                "flex items-start gap-3 rounded-xl px-2.5 py-2.5 text-sm hover:bg-slate-50",
                                fresh && "bg-sky-50/60",
                              )}
                            >
                              <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full", style.tone)}>
                                <Icon size={15} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={cn("block leading-snug text-slate-800", fresh && "font-semibold text-slate-900")}>
                                  {n.title}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-400">{timeAgo(n.at, now)}</span>
                              </span>
                              {fresh ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="New" /> : null}
                            </Link>
                          );
                        })
                      )}
                    </div>
                    {alerts.length ? (
                      <div className="border-t border-slate-100 p-2">
                        <p className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Needs attention
                        </p>
                        {alerts.map((a) => (
                          <Link
                            key={a.key}
                            href={a.href}
                            onClick={() => setBellOpen(false)}
                            className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
                          >
                            <span className="min-w-0">{a.label}</span>
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">{a.count}</span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="relative" data-user-menu>
                <button
                  type="button"
                  onClick={() => setUserOpen((v) => !v)}
                  aria-expanded={userOpen}
                  className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 hover:bg-white"
                >
                  {profile.id ? (
                    <Avatar id={profile.id} name={profile.name} size={38} />
                  ) : (
                    <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-[#13213d] text-sm font-bold text-white">
                      {profile.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span
                    className={cn(
                      "hidden max-w-[180px] truncate text-sm font-semibold text-slate-900",
                      hasPageHeader ? "2xl:inline" : "md:inline",
                    )}
                  >
                    {profile.name}
                  </span>
                  <ChevronDown size={16} className={cn("hidden text-slate-500", hasPageHeader ? "2xl:inline" : "md:inline")} />
                </button>
                {userOpen ? (
                  <div className="absolute right-0 top-12 z-40 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{profile.name}</p>
                      <p className="truncate text-xs text-slate-500" title={email}>
                        {email}
                      </p>
                    </div>
                    {profile.id ? (
                      <Link
                        href={`/equipa/${profile.id}`}
                        onClick={() => setUserOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                      >
                        <UserRound size={16} className="text-slate-500" /> My profile
                      </Link>
                    ) : null}
                    <form action={signOut}>
                      <button
                        type="submit"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                      >
                        <LogOut size={16} className="text-slate-500" /> Sign out
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className={cn("min-w-0 px-3 sm:px-4 lg:px-6", isSchedule ? "pb-0" : "pb-16")}>
          <ShellHeaderProvider value={shellHeader}>{children}</ShellHeaderProvider>
        </main>
      </div>

      <CompleteVisitHost />

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-[#f9fafc] shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-5 grid h-9 w-9 place-items-center rounded-lg text-slate-600 hover:bg-white"
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
