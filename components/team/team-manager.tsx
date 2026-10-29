"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClickableRow } from "@/components/clickable-row";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/team/team-ui";
import { addTeamMemberAction, type TeamActionResult } from "@/lib/team/actions";
import { ROLE_LABEL } from "@/lib/team/member";
import type { TeamMember } from "@/lib/team/queries";

const field =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-emerald-100";

/** Jobber Settings › Manage team: the list, search and "Invite New Member". */
export function TeamManager({ team }: { team: TeamMember[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = async (work: Promise<TeamActionResult>, after?: () => void) => {
    setPending(true);
    setMessage(null);
    const result = await work;
    setPending(false);
    if (!result.ok) {
      setMessage(result.message ?? "Something went wrong.");
      return;
    }
    after?.();
    router.refresh();
  };

  const q = query.trim().toLowerCase();
  const shown = team.filter((m) => !q || `${m.name} ${m.email ?? ""} ${m.phone ?? ""}`.toLowerCase().includes(q));
  const active = shown.filter((m) => m.active);
  const inactive = shown.filter((m) => !m.active);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Add team member</h2>
        <form
          className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            run(addTeamMemberAction(name, email), () => {
              setName("");
              setEmail("");
            });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" aria-label="Full name" className={field} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address (optional)" aria-label="Email address" className={field} />
          <button
            type="submit"
            disabled={pending || !name.trim()}
            className="h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            Add member
          </button>
        </form>
        {message ? <p className="mt-2 text-xs font-semibold text-rose-700">{message}</p> : null}
      </Card>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search team members"
        aria-label="Search team members"
        className={field}
      />

      <MemberTable title={`Active (${active.length})`} members={active} />
      {inactive.length > 0 ? <MemberTable title={`Deactivated (${inactive.length})`} members={inactive} /> : null}
    </div>
  );
}

function MemberTable({ title, members }: { title: string; members: TeamMember[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-2 font-extrabold text-ink">{title}</h2>
      {members.length === 0 ? (
        <p className="text-sm text-ink-mute">No team members.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full fit-table text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-semibold text-ink-mute">
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 pr-4 font-semibold">Role</th>
                <th className="py-2 pr-4 font-semibold">Contact</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <ClickableRow key={m.id} href={`/equipa/${m.id}`}>
                  <td className="py-3 pr-4">
                    <Link href={`/equipa/${m.id}`} className="flex items-center gap-2.5 font-bold text-accent hover:underline">
                      <Avatar id={m.id} name={m.name} size={30} />
                      {m.name}
                    </Link>
                  </td>
                  <td data-label="Role" className="py-3 pr-4 text-ink">{ROLE_LABEL[m.role ?? "user"]}</td>
                  <td data-label="Contact" className="py-3 pr-4 text-ink-soft [overflow-wrap:anywhere]">
                    {[m.email, m.phone].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        m.active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${m.active ? "bg-emerald-600" : "bg-stone-400"}`} />
                      {m.active ? "Active" : "Deactivated"}
                    </span>
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
