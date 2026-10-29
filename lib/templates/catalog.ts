// Jobber Settings › Emails & Text Messages. Defaults are the texts of the Moving London
// Jobber account (29 Oct 2026); an account's edits live in message_templates.
// Pure module: safe for client components and unit tests.

export type TemplateStage = "requests" | "quotes" | "jobs" | "invoices" | "payments";

export const TEMPLATE_STAGES: { key: TemplateStage; label: string }[] = [
  { key: "requests", label: "Requests" },
  { key: "quotes", label: "Quotes" },
  { key: "jobs", label: "Jobs" },
  { key: "invoices", label: "Invoices" },
  { key: "payments", label: "Payments" },
];

export type TemplateDefault = {
  stage: TemplateStage;
  label: string;
  description: string;
  email: { subject: string; body: string };
  /** null when Jobber has no text message for this template. */
  sms: string | null;
};

export const TEMPLATE_CATALOG = {
  request_submitted: {
    stage: "requests",
    label: "Submitted request",
    description: "Notifies a client that a request has been received",
    email: { subject: "Thanks for your request!", body: "Hello {{CLIENT_NAME}},\n\nThank you for your message! Your request has been received! We'll be in touch soon.\n\nPlease find a copy of your request below.\n\nIf you have any questions regarding this request, please don't hesitate to get in touch with us at {{DEFAULT_PHONE}}.\n\nBest Wishes,\n\n{{COMPANY_NAME}}" },
    sms: "Hi {{CLIENT_FIRST_NAME}}, thanks for your request! {{COMPANY_NAME}} will be in touch soon.",
  },
  request_declined: {
    stage: "requests",
    label: "Declining work",
    description: "Notifies a client that you declined their request and can’t take the work",
    email: { subject: "Thank you for reaching out", body: "Hello {{CLIENT_NAME}},\n\nThank you so much for reaching out and considering us for this opportunity. Unfortunately, we're not available to take this on at the moment.\n\nIf you have any questions, please don't hesitate to get in touch with us at {{DEFAULT_EMAIL}}.\n\nSincerely,\n\n{{COMPANY_NAME}}" },
    sms: "Hi {{CLIENT_NAME}}, thanks for reaching out.\nWe're currently unavailable for this work. Please contact us with any questions.\n- {{COMPANY_NAME}}",
  },
  quote_sent: {
    stage: "quotes",
    label: "New quote",
    description: "Notifies a client about a new quote when sent",
    email: { subject: "Quote from {{COMPANY_NAME}} - {{CURRENT_DATE}}", body: "Hi {{CLIENT_NAME}},\n\nWe are sending this quote based on the information you provided. Please note that we can tailor this quote to your needs, such as the number of people and flexible payment methods, including bank transfer, debit and credit cards, and Klarna.\n\nWith Klarna, you can pay in up to 3 installments, so you don’t have to worry about paying the entire amount in a single payment.\n\nDeposit required: {{DEPOSIT_AMOUNT}}\n\nIf you have any questions or concerns regarding this quote, please don't hesitate to get in touch with us at {{DEFAULT_PHONE}} or by WhatsApp +44 7710 251699.\n\nLooking forward to hearing from you.\n\nBest wishes,\n\n{{COMPANY_NAME}}" },
    sms: "Hi {{CLIENT_NAME}}, here's your quote from {{COMPANY_NAME}}.",
  },
  quote_followup: {
    stage: "quotes",
    label: "Quote follow-up",
    description: "Follows up on a quote the client has not answered yet",
    email: { subject: "Following up on quote {{QUOTE_NUMBER}}", body: "Hi {{CLIENT_FIRST_NAME}},\n\nWe just wanted to send a quick note to see if you had a chance to look at the quote we sent recently? We're happy to answer any questions you might have.\n\nWe're excited to get to work, so if you'd like to proceed let us know and we can get started!\n\nThanks,\n\n{{COMPANY_NAME}}\n{{DEFAULT_PHONE}}" },
    sms: "Hi {{CLIENT_FIRST_NAME}}, just a quick note that you have a quote from {{COMPANY_NAME}}.",
  },
  quote_approved: {
    stage: "quotes",
    label: "Quote approval",
    description: "Thanks the client when they approve a quote, with the booking details",
    email: { subject: "Thank you for approving quote {{QUOTE_NUMBER}}", body: "Hi {{CLIENT_NAME}},\n\nWe've received your approval of quote {{QUOTE_NUMBER}}. Thank you for choosing us—we'll be in touch soon with next steps.\n\nHere are the details of your booking:\n\n{{JOB_DETAILS}}\n\nIf you have any questions or concerns, please don't hesitate to get in touch with us at {{DEFAULT_PHONE}}.\n\nWe appreciate your business.\n\nRegards,\n\n{{COMPANY_NAME}}" },
    sms: "Hi {{CLIENT_FIRST_NAME}}, thank you for approving quote {{QUOTE_NUMBER}} with {{COMPANY_NAME}}!\n\n{{JOB_DETAILS}}",
  },
  job_booking: {
    stage: "jobs",
    label: "Booking confirmation",
    description: "Notifies a client that a job has been scheduled when sent",
    email: { subject: "Booking confirmation from {{COMPANY_NAME}}", body: "Hi {{CLIENT_NAME}},\n\nYour booking is confirmed! ✅\nThank you choosing us.\n\n{{JOB_DETAILS}}\n\nBest,\n\n{{COMPANY_NAME}}" },
    sms: "Good news, your work has been booked!\n\n{{JOB_DETAILS}}",
  },
  visit_reschedule: {
    stage: "jobs",
    label: "Visit rescheduling notification",
    description: "Notifies a client that a visit has been rescheduled when sent",
    email: { subject: "Appointment Update from {{COMPANY_NAME}}", body: "Hi {{CLIENT_NAME}},\n\nYour visit has been rescheduled to:\n\n{{VISIT_RESCHEDULE_DETAILS}}\n\nSincerely,\n\n{{COMPANY_NAME}}" },
    sms: "Your visit with {{COMPANY_NAME}} has been rescheduled.\n\n{{VISIT_RESCHEDULE_DETAILS}}",
  },
  visit_reminder: {
    stage: "jobs",
    label: "Visit reminder",
    description: "Reminds a client about an upcoming visit",
    email: { subject: "Moving reminder by {{COMPANY_NAME}} - {{APPOINTMENT_DATE}}", body: "Hi {{CLIENT_NAME}},\n\nJust a friendly reminder that we have an upcoming appointment.\n\n{{WORK_DETAILS}}\n\nIf you have any questions or concerns, please don't hesitate to get in touch with us at {{DEFAULT_PHONE}}.\n\nSincerely,\n{{COMPANY_NAME}}" },
    sms: "Just a friendly reminder that we have an upcoming appointment.\n\n{{WORK_DETAILS}}",
  },
  job_followup: {
    stage: "jobs",
    label: "Job follow-up",
    description: "Asks for feedback after a job is closed",
    email: { subject: "Thank You: Your service visit by {{COMPANY_NAME}} is complete", body: "Hi {{CLIENT_FIRST_NAME}},\n\nIf you have any questions about the work or service our team has provided you, please do not hesitate to contact us.\n\nWe work hard to provide the best experience for our customers and are always looking for ways to improve.\nIf you have a moment to send us a review, it would be greatly appreciated.\n\nTo give your review on Checkatrade, just click here 👉🏼 https://shorturl.at/j9ltX\n\nTo give your review on Google, just click here 👉🏼 https://g.page/r/CS-RYywK4Bo2EAE/review\n\nThank you for your support so far! You can always count on us!\n\nBest wishes,\nThe team at {{COMPANY_NAME}}." },
    sms: null,
  },
  invoice_sent: {
    stage: "invoices",
    label: "New invoice",
    description: "Notifies a client about a new invoice when sent",
    email: { subject: "Invoice from {{COMPANY_NAME}} - {{INVOICE_SUBJECT}}", body: "Hi {{CLIENT_NAME}},\n\nThank you for your recent business with us.\n\nThe invoice total is {{INVOICE_TOTAL}}, with {{INVOICE_BALANCE}} to be paid by {{INVOICE_DUE_DATE}}.\n\nIf you have any questions or concerns regarding this invoice, please don't hesitate to get in touch with us at {{DEFAULT_EMAIL}}.\n\nSincerely,\n\n{{COMPANY_NAME}}" },
    sms: "Hi {{CLIENT_NAME}}, here's your invoice from {{COMPANY_NAME}} for {{INVOICE_BALANCE}}.",
  },
  invoice_followup: {
    stage: "invoices",
    label: "Invoice past due",
    description: "Reminds a client that an invoice is awaiting payment or past due",
    email: { subject: "Your invoice from {{COMPANY_NAME}} is {{DAYS_OVERDUE}}", body: "Hi {{CLIENT_NAME}},\n\nThis is a reminder that payment on Invoice {{INVOICE_NUMBER}} is {{DAYS_OVERDUE}}.\n\nIf the payment has already been sent, please ignore this email.\n\nThanks,\n{{COMPANY_NAME}}" },
    sms: "Hi {{CLIENT_FIRST_NAME}}, just a quick note about your outstanding invoice from {{COMPANY_NAME}}.",
  },
  payment_receipt: {
    stage: "payments",
    label: "Payment & deposit receipts",
    description: "Receipt sent when a payment or deposit is recorded",
    email: { subject: "Receipt for {{PAYMENT_OR_DEPOSIT}} from {{COMPANY_NAME}} - {{CURRENT_DATE}}", body: "Hi {{CLIENT_NAME}},\n\nThis email has a receipt attached to it for your {{PAYMENT_OR_DEPOSIT}} of {{PAYMENT_AMOUNT}}.\n\nPlease keep this email for your reference.\n\nIf you have any questions or concerns, please don't hesitate to get in touch with us at {{DEFAULT_EMAIL}}.\n\nSincerely,\n\n{{COMPANY_NAME}}" },
    sms: "Hi {{CLIENT_FIRST_NAME}}, thank you! We received your {{PAYMENT_OR_DEPOSIT}} of {{PAYMENT_AMOUNT}}. - {{COMPANY_NAME}}",
  },
} satisfies Record<string, TemplateDefault>;

export type TemplateKey = keyof typeof TEMPLATE_CATALOG;

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_CATALOG) as TemplateKey[];

export function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_CATALOG, value);
}

/** "Insert Variable" menu, grouped like Jobber's. Samples feed the preview. */
export const TEMPLATE_VARIABLES: { section: string; items: { name: string; label: string; sample: string }[] }[] = [
  { section: "General", items: [{ name: "CURRENT_DATE", label: "Current Date", sample: "29/10/2026" }] },
  {
    section: "Client",
    items: [
      { name: "CLIENT_NAME", label: "Name", sample: "Natasha Wheeler" },
      { name: "CLIENT_FIRST_NAME", label: "First Name", sample: "Natasha" },
      { name: "CLIENT_LAST_NAME", label: "Last Name", sample: "Wheeler" },
      { name: "CLIENT_COMPANY_NAME", label: "Company Name", sample: "Quest Provider" },
    ],
  },
  {
    section: "Your Branding",
    items: [
      { name: "COMPANY_NAME", label: "Company Name", sample: "Moving London Removals & Transport" },
      { name: "DEFAULT_EMAIL", label: "Contact Email", sample: "hello@movinglondontransport.com" },
      { name: "DEFAULT_PHONE", label: "Phone Number", sample: "020 335 52161" },
    ],
  },
  { section: "Request", items: [{ name: "REQUEST_NUMBER", label: "Number", sample: "REQ-0011" }] },
  {
    section: "Quote",
    items: [
      { name: "QUOTE_NUMBER", label: "Number", sample: "Q-0016" },
      { name: "QUOTE_TOTAL", label: "Total", sample: "£475.00" },
      { name: "DEPOSIT_AMOUNT", label: "Deposit Amount", sample: "£49.99" },
      { name: "DISCOUNT_AMOUNT", label: "Discount Amount", sample: "£20.00" },
      { name: "QUOTE_SENT_DATE", label: "Sent Date", sample: "29/10/2026" },
    ],
  },
  {
    section: "Job",
    items: [
      { name: "JOB_NUMBER", label: "Number", sample: "J-0012" },
      { name: "JOB_TITLE", label: "Job Title", sample: "Removal Service" },
      { name: "JOB_DATE", label: "Job Date", sample: "05/11/2026" },
      { name: "APPOINTMENT_DATE", label: "Appointment Date", sample: "05/11/2026" },
      { name: "ARRIVAL_WINDOW", label: "Arrival Window", sample: "09:00 – 12:00" },
      { name: "ASSIGNED_TO", label: "Assigned Team", sample: "Everaldo Aquino, Jailton Bento" },
      { name: "JOB_LOCATION", label: "Collection Address", sample: "12 Mare Street, E8 4RP" },
      {
        name: "JOB_DETAILS",
        label: "Job Details",
        sample:
          "Date: 05/11/2026\nTime: 09:00 – 12:00\nTeam: Everaldo Aquino, Jailton Bento\nCollection address: 12 Mare Street, E8 4RP",
      },
      {
        name: "WORK_DETAILS",
        label: "Work Details",
        sample: "Date: 05/11/2026\nWhere: 12 Mare Street, E8 4RP\nEstimated Arrival Time: 09:00 – 12:00",
      },
      {
        name: "VISIT_RESCHEDULE_DETAILS",
        label: "Visit Reschedule Details",
        sample: "Date: 06/11/2026\nTime: 10:00 – 13:00\nWhere: 12 Mare Street, E8 4RP",
      },
    ],
  },
  {
    section: "Invoice",
    items: [
      { name: "INVOICE_NUMBER", label: "Number", sample: "INV-0009" },
      { name: "INVOICE_SUBJECT", label: "Subject", sample: "Removal Service" },
      { name: "INVOICE_TOTAL", label: "Total", sample: "£380.00" },
      { name: "INVOICE_BALANCE", label: "Balance", sample: "£380.00" },
      { name: "INVOICE_DUE_DATE", label: "Due Date", sample: "28/10/2026" },
      { name: "DAYS_OVERDUE", label: "Days Overdue", sample: "3 days overdue" },
    ],
  },
  {
    section: "Payment",
    items: [
      { name: "PAYMENT_AMOUNT", label: "Payment Amount", sample: "£380.00" },
      { name: "PAYMENT_OR_DEPOSIT", label: "Payment Type", sample: "payment" },
    ],
  },
];

export const SAMPLE_VARIABLES: Record<string, string> = Object.fromEntries(
  TEMPLATE_VARIABLES.flatMap((s) => s.items.map((v) => [v.name, v.sample])),
);

/** Fills {{VARIABLE}} placeholders. Unknown names stay as typed so a typo is visible. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match,
  );
}

/**
 * renderTemplate for letters: a line that is only empty variables, or "Label: {{EMPTY}}",
 * is dropped, and the blank lines it leaves are collapsed.
 */
export function renderLetter(text: string, vars: Record<string, string>): string {
  const lines = text.split("\n").filter((line) => {
    const names = [...line.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
    if (names.length === 0) return true;
    const empty = names.every((n) => Object.prototype.hasOwnProperty.call(vars, n) && !vars[n].trim());
    const label = line.replace(/\{\{[^}]*\}\}/g, "").trim();
    return !(empty && (label === "" || label.endsWith(":")));
  });
  return renderTemplate(lines.join("\n"), vars).replace(/\n{3,}/g, "\n\n").trim();
}

/** "Date: …\nTime: …\nTeam: …\nCollection address: …", skipping what isn't known yet. */
export function jobDetailsText(input: { date: string; time: string; team: string; address: string }): string {
  return [
    ["Date", input.date],
    ["Time", input.time],
    ["Team", input.team],
    ["Collection address", input.address],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}
