"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/team/team-ui";
import {
  addTeamMemberAction,
  renameTeamMemberAction,
  setTeamMemberActiveAction,
  type TeamActionResult,
} from "@/lib/team/actions";
import type { TeamMember } from "@/lib/team/queries";

const field =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-emerald-100";

export function TeamManager({ team }: { team: TeamMember[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
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

  return (
    <Card className="p-5">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(addTeamMemberAction(name), () => setName(""));
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          aria-label="New team member name"
          className={field}
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="h-10 shrink-0 rounded-xl bg-accent px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          Add team member
        </button>
      </form>
      {message ? <p className="mt-2 text-xs font-semibold text-rose-700">{message}</p> : null}

      <div className="mt-4 divide-y divide-line">
        {team.length === 0 ? <p className="py-3 text-sm text-ink-mute">No team members yet.</p> : null}
        {team.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 py-3">
            <Avatar id={m.id} name={m.name} size={32} />
            {editing?.id === m.id ? (
              <form
                className="flex min-w-0 flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(renameTeamMemberAction(m.id, editing.name), () => setEditing(null));
                }}
              >
                <input
                  autoFocus
                  value={editing.name}
                  onChange={(e) => setEditing({ id: m.id, name: e.target.value })}
                  aria-label="Name"
                  className={field}
                />
                <button type="submit" disabled={pending} className="h-10 rounded-xl bg-accent px-3 text-sm font-bold text-white">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-10 rounded-xl border border-line px-3 text-sm font-bold text-ink"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className={m.active ? "truncate font-bold text-ink" : "truncate font-bold text-ink-mute line-through"}>
                    {m.name}
                  </p>
                  <p className="text-xs text-ink-soft">{m.active ? "Active" : "Deactivated"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing({ id: m.id, name: m.name })}
                  aria-label={`Rename ${m.name}`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-cream hover:text-ink"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(setTeamMemberActiveAction(m.id, !m.active))}
                  className="h-8 rounded-lg border border-line px-3 text-xs font-bold text-ink hover:bg-cream disabled:opacity-50"
                >
                  {m.active ? "Deactivate" : "Reactivate"}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
