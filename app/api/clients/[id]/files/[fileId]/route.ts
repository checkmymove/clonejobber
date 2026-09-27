import { requireAdmin } from "@/lib/auth/session";
import { sql } from "@/lib/db";

// Serves client file bytes to the signed-in administrator only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  await requireAdmin();
  const { id, fileId } = await params;
  const rows = await sql<{ mime_type: string; data: Buffer; file_name: string }[]>`
    select mime_type, data, file_name from client_files
    where id = ${fileId} and client_id = ${id} limit 1
  `;
  const file = rows[0];
  if (!file) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(file.data as unknown as BodyInit, {
    headers: {
      "content-type": file.mime_type,
      "content-disposition": `inline; filename="${encodeURIComponent(file.file_name)}"`,
      "cache-control": "private, max-age=3600",
    },
  });
}
