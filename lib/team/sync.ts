import "server-only";
import { sql } from "@/lib/db";

/**
 * The job form saves each visit's Assign as "Name, Name" (job_visits.assignee).
 * This mirrors it into job_visit_members, which the dashboard and time tracking read.
 * Names that aren't on the team are left as text only.
 */
export async function syncVisitMembersFromText(jobId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      delete from job_visit_members vm
      using job_visits v
      where vm.visit_id = v.id and v.job_id = ${jobId}
    `;
    await tx`
      insert into job_visit_members (visit_id, member_id)
      select distinct v.id, m.id
      from job_visits v
      join jobs j on j.id = v.job_id
      cross join lateral regexp_split_to_table(v.assignee, '\\s*,\\s*') as n(name)
      join team_members m on m.company_id = j.company_id and m.name = trim(n.name)
      where v.job_id = ${jobId} and trim(n.name) <> ''
      on conflict do nothing
    `;
  });
}
