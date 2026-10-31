"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  Plus,
  ReceiptText,
  Search,
  Settings,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { CompleteVisitHost } from "@/components/jobs/complete-visit-dialog";
import { Avatar } from "@/components/team/team-ui";
import { cn } from "@/lib/cn";
import type { ShellAlert, ShellProfile } from "@/lib/shell";

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

export function AppShell({
  children,
  email,
  profile,
  alerts,
}: {
  children: React.ReactNode;
  email: string;
  profile: ShellProfile;
  alerts: ShellAlert[];
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
  const attention = alerts.reduce((s, a) => s + a.count, 0);

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
              className="hidden h-11 w-full max-w-[390px] items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-within:border-[#1d4ed8] sm:flex"
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

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="relative" data-create-menu>
                <button
                  type="button"
                  onClick={() => setCreateOpen((v) => !v)}
                  aria-expanded={createOpen}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#13213d] px-3.5 text-sm font-semibold text-white hover:bg-[#1e3a5f]"
                >
                  {createOpen ? <X size={17} /> : <Plus size={17} />}
                  <span className="hidden sm:inline">Create</span>
                </button>
                {createOpen ? (
                  <div className="absolute right-0 top-12 z-40 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    {CREATE_ITEMS.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setCreateOpen(false)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <item.icon size={17} className="text-slate-500" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative" data-bell-menu>
                <button
                  type="button"
                  onClick={() => setBellOpen((v) => !v)}
                  aria-expanded={bellOpen}
                  aria-label={attention ? `${attention} things need attention` : "Notifications"}
                  className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-700 hover:bg-white"
                >
                  <Bell size={21} strokeWidth={1.75} />
                  {attention ? (
                    <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-canvas">
                      {attention > 9 ? "9+" : attention}
                    </span>
                  ) : null}
                </button>
                {bellOpen ? (
                  <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                    <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Needs attention
                    </p>
                    {alerts.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-slate-500">You’re all caught up.</p>
                    ) : (
                      alerts.map((a) => (
                        <Link
                          key={a.key}
                          href={a.href}
                          onClick={() => setBellOpen(false)}
                          className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-50"
                        >
                          {a.label}
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                            {a.count}
                          </span>
                        </Link>
                      ))
                    )}
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
                  <span className="hidden max-w-[180px] truncate text-sm font-semibold text-slate-900 md:inline">
                    {profile.name}
                  </span>
                  <ChevronDown size={16} className="hidden text-slate-500 md:inline" />
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
          {children}
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
