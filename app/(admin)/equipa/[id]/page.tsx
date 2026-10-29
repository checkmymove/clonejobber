import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { MemberForm } from "@/components/team/member-form";
import { COMPANY_SLUG } from "@/lib/company";
import { isUuid } from "@/lib/funnel/validation";
import { getTeamMember } from "@/lib/team/queries";

export const dynamic = "force-dynamic";

export default async function MembroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const member = await getTeamMember(COMPANY_SLUG, id);
  if (!member) notFound();
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={member.name}
        subtitle="Manage team"
        action={
          <Link
            href="/equipa"
            className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
          >
            ← Team
          </Link>
        }
      />
      <MemberForm member={member} />
    </div>
  );
}
