"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { TimeField } from "@/components/time-field";
import { Avatar } from "@/components/team/team-ui";
import { saveTeamMemberAction, setTeamMemberActiveAction } from "@/lib/team/actions";
import {
  PERMISSION_PRESETS,
  ROLE_LABEL,
  WEEKDAYS,
  type MemberInput,
  type PermissionPreset,
} from "@/lib/team/member";
import type { TeamMemberDetail } from "@/lib/team/queries";

const field =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-emerald-100";

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-ink-mute">
      {text}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

/** Jobber Manage team › member: Personal info, Working hours and Permissions. */
export function MemberForm({ member }: { member: TeamMemberDetail }) {
  const router = useRouter();
  const [draft, setDraft] = useState<MemberInput>({
    name: member.name,
    email: member.email,
    phone: member.phone,
    street: member.street,
    city: member.city,
    province: member.province,
    postcode: member.postcode,
    country: member.country,
    admin: member.role !== "user",
    permission: member.permission,
    workingHours: member.workingHours,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const set = (patch: Partial<MemberInput>) => setDraft((d) => ({ ...d, ...patch }));
  const owner = member.role === "owner";

  const save = async () => {
    setPending(true);
    setMessage(null);
    const result = await saveTeamMemberAction(member.id, draft);
    setPending(false);
    setErrors(result.errors ?? {});
    setMessage({ ok: result.ok, text: result.ok ? "Saved." : result.message ?? "Could not save." });
    if (result.ok) router.refresh();
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Avatar id={member.id} name={member.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold text-ink">{member.name}</p>
            <p className="text-sm text-ink-soft">
              {ROLE_LABEL[member.role]} · {member.active ? "Active" : "Deactivated"}
              {member.lastActive ? ` · last active ${new Date(member.lastActive).toLocaleString("en-GB", { timeZone: "Europe/London" })}` : ""}
            </p>
          </div>
        </div>
        <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Personal info</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Label text="Full name">
            <input className={field} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            {errors.name ? <span className="mt-1 block text-rose-700">{errors.name}</span> : null}
          </Label>
          <Label text="Email address">
            <input className={field} value={draft.email} onChange={(e) => set({ email: e.target.value })} />
            {errors.email ? <span className="mt-1 block text-rose-700">{errors.email}</span> : null}
          </Label>
          <Label text="Mobile phone number (if applicable)">
            <input className={field} value={draft.phone} onChange={(e) => set({ phone: e.target.value })} />
            {errors.phone ? <span className="mt-1 block text-rose-700">{errors.phone}</span> : null}
          </Label>
          <Label text="Street address">
            <input className={field} value={draft.street} onChange={(e) => set({ street: e.target.value })} />
          </Label>
          <Label text="City">
            <input className={field} value={draft.city} onChange={(e) => set({ city: e.target.value })} />
          </Label>
          <Label text="Province">
            <input className={field} value={draft.province} onChange={(e) => set({ province: e.target.value })} />
          </Label>
          <Label text="Postal code">
            <input className={field} value={draft.postcode} onChange={(e) => set({ postcode: e.target.value })} />
          </Label>
          <Label text="Country">
            <input className={field} value={draft.country} onChange={(e) => set({ country: e.target.value })} />
          </Label>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Working hours</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Individual working hours show whether this person is available on the schedule.
        </p>
        <div className="divide-y divide-line">
          {WEEKDAYS.map((day) => {
            const hours = draft.workingHours[day.key];
            return (
              <div key={day.key} className="flex flex-wrap items-center gap-3 py-2.5">
                <label className="flex w-36 items-center gap-2 text-sm font-semibold text-ink">
                  <input
                    type="checkbox"
                    checked={hours !== null}
                    onChange={(e) =>
                      set({
                        workingHours: { ...draft.workingHours, [day.key]: e.target.checked ? ["08:00", "19:00"] : null },
                      })
                    }
                    className="size-4 accent-[#388623]"
                  />
                  {day.label}
                </label>
                {hours ? (
                  <div className="flex items-center gap-2">
                    <TimeField
                      ariaLabel={`${day.label} start`}
                      className={`${field} w-28`}
                      value={hours[0]}
                      onChange={(v) => set({ workingHours: { ...draft.workingHours, [day.key]: [v, hours[1]] } })}
                    />
                    <span className="text-ink-mute">–</span>
                    <TimeField
                      ariaLabel={`${day.label} end`}
                      className={`${field} w-28`}
                      value={hours[1]}
                      onChange={(v) => set({ workingHours: { ...draft.workingHours, [day.key]: [hours[0], v] } })}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-ink-mute">Unavailable</span>
                )}
                {errors[`hours.${day.key}`] ? (
                  <span className="w-full text-xs font-semibold text-rose-700">{errors[`hours.${day.key}`]}</span>
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Permissions</h2>
        <label className="flex items-start gap-2.5 rounded-xl border border-line p-3">
          <input
            type="checkbox"
            checked={draft.admin}
            disabled={owner}
            onChange={(e) => set({ admin: e.target.checked })}
            className="mt-0.5 size-4 accent-[#388623]"
          />
          <span>
            <span className="block font-bold text-ink">Make administrator</span>
            <span className="block text-sm text-ink-soft">
              This allows them access to everything within the account — including billing, reports, client list,
              editing all user permissions, etc.
            </span>
          </span>
        </label>
        <p className="mb-2 mt-4 font-bold text-ink">Preset permission levels</p>
        <p className="mb-3 text-sm text-ink-soft">Start with a preset permission level.</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {PERMISSION_PRESETS.map((p) => (
            <label
              key={p.key}
              className={`block cursor-pointer rounded-xl border p-3 ${
                draft.permission === p.key ? "border-accent bg-accent-soft" : "border-line"
              }`}
            >
              <span className="flex items-center gap-2 font-bold text-ink">
                <input
                  type="radio"
                  name="permission"
                  checked={draft.permission === p.key}
                  onChange={() => set({ permission: p.key as PermissionPreset })}
                  className="accent-[#388623]"
                />
                {p.label}
              </span>
              {p.can.length ? (
                <span className="mt-2 block text-xs">
                  <span className="font-bold text-emerald-800">CAN DO</span>
                  {p.can.map((c) => (
                    <span key={c} className="block text-ink-soft">{c}</span>
                  ))}
                </span>
              ) : null}
              {p.cannot.length ? (
                <span className="mt-2 block text-xs">
                  <span className="font-bold text-rose-800">CAN’T DO</span>
                  {p.cannot.map((c) => (
                    <span key={c} className="block text-ink-soft">{c}</span>
                  ))}
                </span>
              ) : null}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-mute">
          Job To Go has one administrator login; the level records what this person may do in the field.
        </p>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!owner ? (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (member.active && !window.confirm(`Deactivate ${member.name}? Their past visits and time stay.`)) return;
              setPending(true);
              await setTeamMemberActiveAction(member.id, !member.active);
              setPending(false);
              router.refresh();
            }}
            className="h-10 rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink hover:bg-cream disabled:opacity-50"
          >
            {member.active ? "Deactivate" : "Reactivate"}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-3">
          {message ? (
            <span className={`text-sm font-semibold ${message.ok ? "text-emerald-700" : "text-rose-700"}`}>{message.text}</span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="h-10 rounded-xl bg-accent px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
