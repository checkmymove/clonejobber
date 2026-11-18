"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed } from "lucide-react";
import { DashCard, DashTitle } from "@/components/dashboard/kit";
import { colorFor } from "@/components/team/team-ui";
import { initials } from "@/lib/team/time";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  time: string;
  title: string;
  address: string;
  href: string;
  done: boolean;
  people: { id: string; name: string; running: boolean }[];
};

const LONDON: [number, number] = [51.5072, -0.1276];

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Avatars of the people on a visit, stacked; a green ring while someone is clocked in. */
function markerHtml(point: MapPoint): string {
  const running = point.people.some((p) => p.running);
  const ring = running ? "box-shadow:0 0 0 3px #22c55e,0 4px 10px rgba(15,23,42,.25);" : "box-shadow:0 0 0 3px #fff,0 4px 10px rgba(15,23,42,.25);";
  if (point.people.length === 0) {
    const color = point.done ? "#94a3b8" : "#13213d";
    return `<span style="display:block;width:18px;height:18px;border-radius:999px;background:${color};${ring}"></span>`;
  }
  return `<span style="display:flex">${point.people
    .slice(0, 3)
    .map(
      (p, i) =>
        `<span title="${escape(p.name)}" style="display:grid;place-items:center;width:38px;height:38px;border-radius:999px;background:${colorFor(p.id)};color:#fff;font:700 14px/1 var(--font-sans);${ring}margin-left:${i ? -10 : 0}px;opacity:${point.done ? 0.6 : 1}">${escape(initials(p.name))}</span>`,
    )
    .join("")}</span>`;
}

/**
 * Dashboard "Live map – Team location". The crew has no phone app, so a person is
 * placed at the visit they are clocked in on (or assigned to), found from the
 * address postcode.
 */
export function LiveMap({ points, live }: { points: MapPoint[]; live: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const fit = useRef<() => void>(() => {});
  // Rebuild only when the pins change, not on every refresh of the page around it.
  const signature = JSON.stringify(points);

  useEffect(() => {
    const points = JSON.parse(signature) as MapPoint[];
    let cancelled = false;
    let resize: ResizeObserver | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current) return;
      map.current?.remove();
      const m = L.map(box.current, { zoomControl: false, scrollWheelZoom: false, attributionControl: true }).setView(LONDON, 10);
      map.current = m;
      L.control.zoom({ position: "topright" }).addTo(m);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);

      for (const point of points) {
        const width = point.people.length ? 38 + Math.min(point.people.length - 1, 2) * 28 : 18;
        const height = point.people.length ? 38 : 18;
        const icon = L.divIcon({
          className: "",
          html: markerHtml(point),
          iconSize: [width, height],
          iconAnchor: [width / 2, height / 2],
        });
        const names = point.people.map((p) => escape(p.name)).join(", ") || "Unassigned";
        L.marker([point.lat, point.lng], { icon, title: point.title })
          .addTo(m)
          .bindPopup(
            `<div style="font:13px/1.4 var(--font-sans);min-width:180px">
              <div style="font-weight:700;color:#0f172a">${escape(point.time)} · ${escape(point.title)}</div>
              <div style="color:#64748b">${escape(point.address)}</div>
              <div style="margin-top:4px;color:#334155">${names}</div>
              <a href="${escape(point.href)}" style="display:inline-block;margin-top:6px;font-weight:600;color:#1d4ed8">Open job</a>
            </div>`,
          );
      }

      fit.current = () => {
        if (points.length === 0) m.setView(LONDON, 10);
        else if (points.length === 1) m.setView([points[0].lat, points[0].lng], 13);
        else m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [64, 64], maxZoom: 13 });
      };
      fit.current();
      // The card can still be settling its size: re-measure and re-frame once it does.
      resize = new ResizeObserver(() => {
        m.invalidateSize();
        fit.current();
      });
      resize.observe(box.current);
    })();
    return () => {
      cancelled = true;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [signature]);

  return (
    <DashCard className="p-4 sm:p-5">
      <DashTitle
        action={
          live > 0 ? (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              Live tracking · {live} on site
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              No one clocked in
            </span>
          )
        }
      >
        Live map – Team location
      </DashTitle>
      <div className="relative isolate z-0 mt-4 overflow-hidden rounded-xl border border-slate-200">
        <div ref={box} className="h-[640px] w-full bg-slate-100 sm:h-[720px]" aria-label="Map of today’s visits" />
        <button
          type="button"
          onClick={() => fit.current()}
          aria-label="Show all visits"
          title="Show all visits"
          className="absolute right-[10px] top-[86px] z-[1000] grid h-[34px] w-[34px] place-items-center rounded-[4px] border-2 border-black/20 bg-white text-slate-800 hover:bg-slate-50"
        >
          <LocateFixed size={17} />
        </button>
        {points.length === 0 ? (
          <p className="pointer-events-none absolute inset-x-0 bottom-3 z-[1000] mx-auto w-fit rounded-lg bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow">
            No visits with a postcode on this day
          </p>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        People appear at the visit they are clocked in on or assigned to, placed by the address postcode.
      </p>
    </DashCard>
  );
}
