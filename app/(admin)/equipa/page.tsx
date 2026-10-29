import { PageHeader } from "@/components/ui";
import { TeamManager } from "@/components/team/team-manager";
import { COMPANY_SLUG } from "@/lib/company";
import { listTeam } from "@/lib/team/queries";

export const dynamic = "force-dynamic";

export default async function EquipaPage() {
  const team = await listTeam(COMPANY_SLUG, true);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Team"
        subtitle="People you assign to visits. Their clock in/out and time entries show on the dashboard and on each job."
      />
      <TeamManager team={team} />
    </div>
  );
}
