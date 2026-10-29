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
        title="Manage team"
        subtitle="People you assign to visits. Open a member to edit their details, working hours and permissions."
      />
      <TeamManager team={team} />
    </div>
  );
}
