import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateLondon, formatGBP } from "@/lib/format";
import {
  addAppointment,
  addContact,
  addNote,
  addProperty,
  addTag,
  deleteContact,
  deleteClientFile,
  deleteNote,
  deleteProperty,
  logMessage,
  removeTag,
  setAppointmentStatus,
  updateProfile,
  uploadClientFile,
} from "@/lib/clients/crm-actions";
import {
  getAppointments,
  getClientFiles,
  getCommunications,
  getContacts,
  getCrmClient,
  getClientFinancials,
  getLastCommunication,
  getNotes,
  getProperties,
  getTags,
  getWorkOverview,
  mapLink,
} from "@/lib/clients/crm-queries";
import { Badge, Card, EmptyState } from "@/components/ui";
import {
  AppointmentForm,
  ContactForm,
  FileUploadForm,
  MessageForm,
  NoteForm,
  ProfileForm,
  PropertyForm,
  TagForm,
} from "@/components/clients/crm-forms";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  lead: "Lead",
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};

const TERMS_LABEL: Record<string, string> = {
  due_on_receipt: "Due upon receipt",
  net_7: "Net 7",
  net_15: "Net 15",
  net_30: "Net 30",
  custom: "Custom",
};

const TYPE_TABS = [
  { key: "all", label: "All" },
  { key: "request", label: "Requests" },
  { key: "quote", label: "Quotes" },
  { key: "job", label: "Jobs" },
  { key: "invoice", label: "Invoices" },
] as const;

type Scope = "active" | "archived" | "all";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    type?: string;
    scope?: string;
    fsrc?: string;
    fkind?: string;
    page?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab === "communication" || sp.tab === "files" ? sp.tab : "info";

  const c = await getCrmClient(id);
  if (!c) notFound();

  const scope: Scope =
    sp.scope === "archived" || sp.scope === "all" ? sp.scope : "active";
  const typeKey = sp.type ?? "all";
  const types = (
    typeKey === "all" ? ["request", "quote", "job", "invoice"] : [typeKey]
  ) as ("request" | "quote" | "job" | "invoice")[];

  const fsrc = sp.fsrc === "request" || sp.fsrc === "manual" ? sp.fsrc : "all";
  const fkind = sp.fkind === "images" || sp.fkind === "documents" ? sp.fkind : "all";
  const filePage = Math.max(1, Number(sp.page ?? 1) || 1);
  const PER_PAGE = 50;

  const [
    properties,
    contacts,
    work,
    financials,
    comms,
    lastComm,
    filesDate,
    notes,
    tags,
    appointments,
  ] = await Promise.all([
    getProperties(id),
    getContacts(id),
    getWorkOverview(id, types, scope),
    getClientFinancials(id),
    tab === "communication" ? getCommunications(id) : Promise.resolve([]),
    getLastCommunication(id),
    tab === "files"
      ? getClientFiles(id, fsrc, fkind, PER_PAGE, (filePage - 1) * PER_PAGE)
      : Promise.resolve({ files: [], total: 0 }),
    getNotes(id),
    getTags(id),
    getAppointments(id),
  ]);

  const fullName = `${c.title ? c.title + " " : ""}${c.first_name} ${c.last_name}`;
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ tab, ...extra });
    return `?${p.toString()}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={c.status === "active" ? "done" : "draft"}>
              {STATUS_LABEL[c.status] ?? c.status}
            </Badge>
            {c.client_type === "company" ? <Badge tone="sent">Company</Badge> : null}
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            {fullName}
          </h1>
          {c.company_name ? (
            <p className="text-sm text-ink-soft">{c.company_name}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clientes/${id}?tab=communication`}
            className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
          >
            ✉ Email
          </Link>
          <details className="relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center rounded-xl bg-ink px-4 text-sm font-bold text-white hover:opacity-90">
              + Create
            </summary>
            <div className="absolute right-0 top-12 z-30 w-56 rounded-2xl border border-line bg-card p-2 shadow-xl">
              <a
                href={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/r/moving-london`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-cream"
              >
                Request
              </a>
              <a
                href="#schedule"
                className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-cream"
              >
                Appointment
              </a>
              {["Quote", "Job", "Invoice"].map((m) => (
                <span
                  key={m}
                  className="block cursor-not-allowed rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-mute"
                  title={`${m} module arrives in its own phase`}
                >
                  {m} · coming soon
                </span>
              ))}
            </div>
          </details>
          <Link
            href="/clientes"
            className="inline-flex h-10 items-center rounded-xl border border-line bg-card px-4 text-sm font-bold text-ink hover:bg-cream"
          >
            ←
          </Link>
        </div>
      </div>

      {/* Quick info */}
      <Card className="mb-4 grid gap-x-8 gap-y-1.5 p-4 text-sm sm:grid-cols-2">
        <p>
          <span className="text-ink-mute">Main phone: </span>
          <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="font-bold text-accent hover:underline">
            {c.phone}
          </a>
        </p>
        {c.phone_mobile ? (
          <p>
            <span className="text-ink-mute">Mobile phone: </span>
            <a href={`tel:${c.phone_mobile.replace(/\s/g, "")}`} className="font-bold text-accent hover:underline">
              {c.phone_mobile}
            </a>
          </p>
        ) : null}
        <p>
          <span className="text-ink-mute">Main email: </span>
          <a href={`mailto:${c.email}`} className="font-bold text-accent hover:underline">
            {c.email}
          </a>
        </p>
        <p>
          <span className="text-ink-mute">Payment terms: </span>
          <span className="font-semibold text-ink">
            {c.payment_terms === "custom"
              ? c.payment_terms_custom ?? "Custom"
              : (TERMS_LABEL[c.payment_terms] ?? c.payment_terms)}
          </span>
        </p>
        <p>
          <span className="text-ink-mute">Lead source: </span>
          <span className="font-semibold text-ink">{c.lead_source ?? "—"}</span>
        </p>
        <p>
          <span className="text-ink-mute">Ask for a review: </span>
          <span className="font-semibold text-ink">{c.ask_for_review ? "Yes" : "No"}</span>
        </p>
      </Card>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-line bg-card p-1 text-sm font-bold">
        {(
          [
            ["info", "Client information"],
            ["communication", `Communication${comms.length ? ` (${comms.length})` : ""}`],
            ["files", "Files and media"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/clientes/${id}?tab=${key}`}
            className={
              tab === key
                ? "flex-1 rounded-lg bg-cream px-3 py-2 text-center text-ink"
                : "flex-1 rounded-lg px-3 py-2 text-center text-ink-soft hover:text-ink"
            }
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {tab === "info" ? (
            <div className="space-y-4">
              <Card className="p-5" >
                <h2 id="profile" className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                  Profile · edit
                </h2>
                <ProfileForm
                  action={updateProfile.bind(null, id)}
                  defaults={{
                    title: c.title,
                    firstName: c.first_name,
                    lastName: c.last_name,
                    companyName: c.company_name ?? "",
                    clientType: c.client_type,
                    status: c.status,
                    email: c.email,
                    phone: c.phone,
                    phoneMobile: c.phone_mobile,
                    paymentTerms: c.payment_terms,
                    paymentTermsCustom: c.payment_terms_custom ?? "",
                    askForReview: c.ask_for_review,
                  }}
                />
              </Card>

              <Card className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                    Properties ({properties.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {properties.map((p) => (
                    <div key={p.id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-ink">
                          {p.label}
                          {p.is_primary ? (
                            <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">primary</span>
                          ) : null}
                          {p.is_billing ? (
                            <span className="ml-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-900">billing</span>
                          ) : null}
                        </p>
                        <div className="flex gap-2">
                          <a
                            href={mapLink(p)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-accent hover:underline"
                            title="Open in map"
                          >
                            📍 Map
                          </a>
                          <form action={deleteProperty.bind(null, id, p.id)}>
                            <button type="submit" className="text-xs font-bold text-rose-700 hover:underline">
                              Remove
                            </button>
                          </form>
                        </div>
                      </div>
                      <p className="mt-1 text-ink-soft">
                        {p.address_line}
                        {p.street_2 ? `, ${p.street_2}` : ""}
                        {p.city ? `, ${p.city}` : ""}
                        {p.county ? `, ${p.county}` : ""} · {p.postcode}
                        {p.country && p.country !== "United Kingdom" ? ` · ${p.country}` : ""}
                      </p>
                      {p.tax_rate ? (
                        <p className="mt-0.5 text-xs text-ink-mute">Tax: {p.tax_rate}</p>
                      ) : null}
                      {p.instructions ? (
                        <p className="mt-0.5 text-xs text-ink-mute">{p.instructions}</p>
                      ) : null}
                    </div>
                  ))}
                  {properties.length === 0 ? (
                    <p className="text-sm text-ink-mute">No properties yet.</p>
                  ) : null}
                </div>
                <div className="mt-3">
                  <PropertyForm action={addProperty.bind(null, id)} />
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="mb-1 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                  Contacts ({contacts.length})
                </h2>
                <p className="mb-3 text-xs text-ink-mute">
                  Add contacts to keep track of everyone you communicate with.
                </p>
                <div className="space-y-2">
                  {contacts.map((ct) => (
                    <div key={ct.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                      <div>
                        <p className="font-bold text-ink">
                          {ct.name}
                          {ct.role ? <span className="ml-2 font-normal text-ink-mute">{ct.role}</span> : null}
                          {ct.is_primary ? (
                            <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">primary</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {[ct.phone, ct.email].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <form action={deleteContact.bind(null, id, ct.id)}>
                        <button type="submit" className="text-xs font-bold text-rose-700 hover:underline">
                          Remove
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <ContactForm action={addContact.bind(null, id)} />
                </div>
              </Card>

              <Card className="p-5">
                <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                  Work overview
                </h2>
                <div className="mb-1 flex flex-wrap gap-1.5">
                  {(["active", "all", "archived"] as const).map((s) => (
                    <Link
                      key={s}
                      href={`/clientes/${id}${qs({ type: typeKey, scope: s })}`}
                      className={
                        scope === s
                          ? "rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white"
                          : "rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink"
                      }
                    >
                      {s === "active" ? "Status · Active" : s === "all" ? "All" : "Archived"}
                    </Link>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {TYPE_TABS.map((t) => (
                    <Link
                      key={t.key}
                      href={`/clientes/${id}${qs({ type: t.key, scope })}`}
                      className={
                        typeKey === t.key
                          ? "rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white"
                          : "rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink"
                      }
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
                {work.items.length === 0 && work.pendingModules.length === 0 ? (
                  <EmptyState>Nothing here for this filter.</EmptyState>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-mute">
                        <th className="py-2 pr-3 font-bold">Item</th>
                        <th className="py-2 pr-3 font-bold">Date</th>
                        <th className="py-2 pr-3 font-bold">Status</th>
                        <th className="py-2 font-bold">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {work.items.map((w) => (
                        <tr key={w.kind + w.id} className="border-b border-line last:border-0">
                          <td className="py-2.5 pr-3 font-bold text-ink">
                            <Link
                              href={
                                w.kind === "quote"
                                  ? `/cotacoes/${w.id}`
                                  : w.kind === "job"
                                    ? `/servicos/${w.id}`
                                    : w.kind === "invoice"
                                      ? `/faturas/${w.id}`
                                      : `/solicitacoes/${w.id}`
                              }
                              className="hover:underline"
                            >
                              {w.kind === "request"
                                ? "Request "
                                : w.kind === "quote"
                                  ? "Quote "
                                  : w.kind === "job"
                                    ? "Job "
                                    : "Invoice "}
                              {w.ref}
                            </Link>
                          </td>
                          <td className="py-2.5 pr-3 text-[13px] text-ink-soft">
                            {formatDateLondon(w.date)}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge tone={w.status}>{w.statusLabel}</Badge>
                          </td>
                          <td className="py-2.5 text-[13px] text-ink-soft">{w.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {work.pendingModules.length > 0
                  ? work.pendingModules.map((m) => (
                      <p key={m} className="mt-2 rounded-xl bg-cream px-3 py-2 text-[13px] text-ink-soft">
                        {m[0].toUpperCase() + m.slice(1)}s will appear here when the module lands.
                      </p>
                    ))
                  : null}
              </Card>

              <Card className="p-5">
                <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                  Billing
                </h2>
                {financials.invoicesReady ? (
                  <div className="flex gap-6 text-sm">
                    <p>Total invoiced: <strong>{formatGBP(financials.lifetimePence)}</strong></p>
                    <p>Balance: <strong>{formatGBP(financials.balancePence)}</strong></p>
                  </div>
                ) : (
                  <EmptyState>
                    Bill this client to see billing history. Invoices arrive with the billing module.
                  </EmptyState>
                )}
                <h2 className="mb-2 mt-5 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                  Payment methods
                </h2>
                <p className="text-sm text-ink-mute">
                  No payment methods yet. Tokenized methods (Stripe) arrive with the payments phase — card data is never stored here.
                </p>
              </Card>

              <Card className="p-5" >
                <h2 id="schedule" className="mb-1 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                  Client schedule ({appointments.length})
                </h2>
                <p className="mb-3 text-xs text-ink-mute">
                  Scheduled client tasks and events appear here.
                </p>
                <div className="space-y-2">
                  {appointments.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm">
                      <div>
                        <p className="font-bold text-ink">
                          {a.title}
                          <span className="ml-2 text-xs font-normal text-ink-mute">
                            {a.kind.replace("_", " ")} · {a.status}
                          </span>
                        </p>
                        <p className="text-xs text-ink-soft">
                          <span suppressHydrationWarning>
                            {new Date(a.starts_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}
                          </span>
                          {a.request_number ? ` · ${a.request_number}` : ""}
                        </p>
                      </div>
                      {a.status === "scheduled" ? (
                        <form action={setAppointmentStatus.bind(null, id, a.id, "done")}>
                          <button type="submit" className="text-xs font-bold text-accent hover:underline">
                            Mark done
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))}
                  {appointments.length === 0 ? (
                    <p className="text-sm text-ink-mute">Nothing scheduled.</p>
                  ) : null}
                </div>
                <div className="mt-3">
                  <AppointmentForm action={addAppointment.bind(null, id)} />
                </div>
              </Card>
            </div>
          ) : null}

          {tab === "communication" ? (
            <div className="space-y-4">
              <MessageForm action={logMessage.bind(null, id)} />
              <Card className="p-5">
                <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                  History ({comms.length})
                </h2>
                <div className="space-y-3">
                  {comms.map((m) => (
                    <article key={m.id} className="rounded-xl border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone={m.channel === "email" ? "sent" : "review"}>{m.channel}</Badge>
                        <Badge tone={m.status === "opened" ? "done" : "draft"}>
                          {m.status}
                          {m.opened_at ? ` · opened ${formatDateLondon(m.opened_at)}` : ""}
                        </Badge>
                        <span className="ml-auto text-ink-mute">
                          {formatDateLondon(m.created_at)}
                        </span>
                      </div>
                      {m.subject ? (
                        <p className="mt-2 text-sm font-bold text-ink">{m.subject}</p>
                      ) : null}
                      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{m.body}</p>
                      <p className="mt-1 text-xs text-ink-mute">
                        To: {c.email}
                        {m.request_id ? (
                          <>
                            {" · "}
                            <Link href={`/solicitacoes/${m.request_id}`} className="font-bold text-accent hover:underline">
                              View request
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </article>
                  ))}
                  {comms.length === 0 ? (
                    <EmptyState>No messages yet.</EmptyState>
                  ) : null}
                </div>
              </Card>
            </div>
          ) : null}

          {tab === "files" ? (
            <Card className="p-5">
              <h2 className="mb-3 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
                All files ({filesDate.total} results)
              </h2>
              <FileUploadForm action={uploadClientFile.bind(null, id)} />
              <div className="mb-3 mt-4 flex flex-wrap gap-1.5">
                {(["all", "request", "manual"] as const).map((s) => (
                  <Link
                    key={s}
                    href={`/clientes/${id}${qs({ type: typeKey, scope, fsrc: s, fkind })}`}
                    className={fsrc === s ? "rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white" : "rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink"}
                  >
                    {s === "all" ? "Source · All" : s === "request" ? "Request" : "Manual"}
                  </Link>
                ))}
                {(["all", "images", "documents"] as const).map((k) => (
                  <Link
                    key={k}
                    href={`/clientes/${id}${qs({ type: typeKey, scope, fsrc, fkind: k, page: "1" })}`}
                    className={fkind === k ? "rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white" : "rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-soft hover:text-ink"}
                  >
                    {k === "all" ? "Type · All" : k === "images" ? "Images" : "Documents"}
                  </Link>
                ))}
              </div>
              {filesDate.files.length === 0 ? (
                <EmptyState>No files for this filter.</EmptyState>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {filesDate.files.map((f) => (
                    <a key={f.source + f.id} href={f.url} target="_blank" rel="noreferrer" title={`${f.file_name} · via ${f.source}`}>
                      {f.mime_type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt={f.file_name} loading="lazy" className="aspect-square w-full rounded-lg border border-line object-cover" />
                      ) : (
                        <span className="grid aspect-square w-full place-items-center rounded-lg border border-line bg-cream text-2xl" role="img" aria-label={f.file_name}>
                          📄
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-between text-xs text-ink-mute">
                <span>
                  Showing {filesDate.total === 0 ? 0 : (filePage - 1) * PER_PAGE + 1}–
                  {Math.min(filePage * PER_PAGE, filesDate.total)} of {filesDate.total} items
                </span>
                <span className="flex gap-1">
                  {filePage > 1 ? (
                    <Link href={`/clientes/${id}${qs({ type: typeKey, scope, fsrc, fkind, page: String(filePage - 1) })}`} className="rounded-lg border border-line px-2 py-1 font-bold text-ink">
                      ← Prev
                    </Link>
                  ) : null}
                  {filePage * PER_PAGE < filesDate.total ? (
                    <Link href={`/clientes/${id}${qs({ type: typeKey, scope, fsrc, fkind, page: String(filePage + 1) })}`} className="rounded-lg border border-line px-2 py-1 font-bold text-ink">
                      Next →
                    </Link>
                  ) : null}
                </span>
              </div>
            </Card>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Overview
            </h2>
            <p className="text-xs text-ink-mute">Lifetime value</p>
            <p className="text-xl font-extrabold text-ink">
              {formatGBP(financials.lifetimePence)}
            </p>
            <p className="mt-2 text-xs text-ink-mute">Current balance</p>
            <p className="text-xl font-extrabold text-ink">
              {formatGBP(financials.balancePence)}
            </p>
            {!financials.invoicesReady ? (
              <p className="mt-2 text-[11px] text-ink-mute">
                Live rule — updates when the Invoices module lands.
              </p>
            ) : null}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Tags
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-xs font-bold text-ink">
                  {t.name}
                  <form action={removeTag.bind(null, id, t.id)} className="inline">
                    <button type="submit" aria-label={`Remove tag ${t.name}`} className="text-ink-mute hover:text-rose-700">
                      ✕
                    </button>
                  </form>
                </span>
              ))}
              {tags.length === 0 ? (
                <span className="text-xs text-ink-mute">No tags yet.</span>
              ) : null}
            </div>
            <div className="mt-2">
              <TagForm action={addTag.bind(null, id)} />
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Last communication
            </h2>
            {lastComm ? (
              <Link href={`/clientes/${id}?tab=communication`} className="block">
                <p className="text-xs text-ink-mute">
                  {formatDateLondon(lastComm.created_at)} · {lastComm.channel}
                </p>
                <p className="mt-1 line-clamp-3 text-sm text-ink">
                  {lastComm.subject ? `${lastComm.subject} — ` : ""}{lastComm.body}
                </p>
              </Link>
            ) : (
              <p className="text-sm text-ink-mute">No messages yet.</p>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">
              Notes · internal
            </h2>
            <NoteForm action={addNote.bind(null, id)} />
            <div className="mt-3 space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl bg-cream p-2.5 text-sm">
                  <p className="whitespace-pre-wrap text-ink">{n.content}</p>
                  <p className="mt-1 flex items-center justify-between text-[11px] text-ink-mute">
                    <span>{n.author} · {formatDateLondon(n.created_at)}</span>
                    <form action={deleteNote.bind(null, id, n.id)} className="inline">
                      <button type="submit" className="font-bold hover:text-rose-700">
                        Excluir
                      </button>
                    </form>
                  </p>
                </div>
              ))}
              {notes.length === 0 ? (
                <p className="text-sm text-ink-mute">No notes yet.</p>
              ) : null}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
