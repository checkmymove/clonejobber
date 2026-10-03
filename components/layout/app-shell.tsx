"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  FileText,
  Hammer,
  House,
  Inbox,
  Mail,
  Menu,
  Package,
  Plus,
  Quote,
  Search,
  Users,
  X,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Dashboard", icon: House, exact: true },
  { href: "/agenda", label: "Schedule", icon: CalendarDays, disabled: true },
  { href: "/clientes", label: "Clients", icon: Users },
  { href: "/solicitacoes", label: "Requests", icon: Inbox },
  { href: "/cotacoes", label: "Quotes", icon: Quote },
  { href: "/servicos", label: "Jobs", icon: Hammer },
  { href: "/faturas", label: "Invoices", icon: FileText },
  { href: "/produtos-servicos", label: "Products & services", icon: Package },
  { href: "/configuracoes/email", label: "Email", icon: Mail },
];

const CREATE_ITEMS = [
  { label: "Client", href: "/clientes/novo", icon: Users },
  { label: "Request", href: "/solicitacoes/novo", icon: Inbox },
  { label: "Quote", href: "/cotacoes/novo", icon: Quote },
  { label: "Job", href: "/servicos/novo", icon: Hammer },
  { label: "Invoice", href: "/faturas/novo", icon: FileText },
];

export function AppShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
}) {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!createOpen) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-create-menu]")) return;
      setCreateOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [createOpen]);

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="relative" data-create-menu>
        <button
          type="button"
          onClick={() => setCreateOpen((v) => !v)}
          aria-expanded={createOpen}
          className="flex h-11 w-full items-center gap-3 rounded-xl bg-ink px-3 text-sm font-bold text-white hover:opacity-90"
        >
          {createOpen ? <X size={18} /> : <Plus size={18} />}
          Create
        </button>
        {createOpen ? (
          <div className="absolute left-0 right-0 top-12 z-30 rounded-2xl border border-line bg-card p-2 shadow-xl">
            {CREATE_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => {
                  setCreateOpen(false);
                  setMobileOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink hover:bg-cream"
              >
                <item.icon size={17} className="text-ink-soft" />
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <nav className="mt-2 flex flex-col gap-0.5" aria-label="Main navigation">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              aria-disabled={item.disabled}
              onClick={(e) => {
                if (item.disabled) e.preventDefault();
                setMobileOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
                active
                  ? "bg-card text-ink shadow-sm"
                  : "text-ink-soft hover:bg-card/70 hover:text-ink",
                item.disabled && "opacity-50",
              )}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-line bg-card p-3">
        <p className="truncate text-xs font-semibold text-ink" title={email}>
          {email}
        </p>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="h-9 w-full rounded-xl border border-line text-sm font-bold text-ink hover:bg-cream"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-line bg-cream/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-card lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-xs font-black text-white">
              O
            </div>
            Opero
          </div>
          <div className="ml-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-mute">
            <Search size={16} />
            <span className="truncate">
              Press / to search — coming soon
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-4 px-4 py-4">
        <aside className="sticky top-[72px] hidden h-[calc(100dvh-88px)] w-64 shrink-0 overflow-y-auto rounded-2xl bg-cream lg:block">
          {sidebar}
        </aside>
        <main className="min-w-0 flex-1 pb-16">{children}</main>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-cream shadow-2xl">
            {sidebar}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
