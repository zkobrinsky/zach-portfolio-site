/*
  Receives the contact form and emails it to Zach. The destination address and the mail service key exist only
  as server environment variables, so neither ever reaches the browser or the public repo.
*/
const MAX_NAME = 100;
const MAX_MESSAGE = 5000;
/** A person takes longer than this to fill in the form. */
const MIN_FILL_MS = 2000;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Email clients ignore stylesheets and web fonts, so this is table layout with inline styles in the site's colors. */
function emailHtml(name: string, email: string, message: string) {
  const mono = "font-family:'Courier New',Courier,monospace";
  const sent = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `<!doctype html>
<html><body style="margin:0;padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:16px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;border:1px solid #c9a14a;background:#0b0d14;">
<tr><td style="padding:40px 40px 10px;${mono};font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#c9a14a;">Incoming transmission</td></tr>
<tr><td style="padding:0 40px 24px;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.2;color:#efe6d2;">${escape(name)}</td></tr>
<tr><td style="padding:0 40px 28px;${mono};font-size:15px;line-height:1.6;color:#efe6d2;">
<a href="mailto:${escape(email)}" style="color:#c9a14a;text-decoration:none;">${escape(email)}</a><br>
<span style="color:#8a8578;">${escape(sent)}</span>
</td></tr>
<tr><td style="padding:0 40px;"><div style="border-top:1px solid #3a3226;"></div></td></tr>
<tr><td style="padding:28px 40px 44px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.7;color:#efe6d2;white-space:pre-wrap;">${escape(message)}</td></tr>
</table>
<p style="margin:16px 0 0;${mono};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8578;">Sent from the contact form on zachkobrinsky.com &middot; Reply goes to the sender</p>
</td></tr>
</table>
</body></html>`;
}

const reply = (status: number, error?: string) => Response.json({ ok: !error, error }, { status });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return reply(400, "That didn't come through. Please try again.");

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();

  // Bots fill in the hidden field or submit instantly. They get a success, so they don't learn to adapt.
  if (body.website || Date.now() - Number(body.startedAt) < MIN_FILL_MS) return reply(200);

  if (!name || name.length > MAX_NAME) return reply(400, "Please add your name.");
  if (!EMAIL.test(email) || email.length > 200) return reply(400, "Please check your email address.");
  if (!message || message.length > MAX_MESSAGE) return reply(400, "Please add a message, under 5,000 characters.");

  const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !CONTACT_TO_EMAIL) return reply(503, "The contact form isn't connected yet.");

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: CONTACT_FROM_EMAIL ?? "Portfolio <onboarding@resend.dev>",
      to: CONTACT_TO_EMAIL,
      reply_to: email,
      subject: `Portfolio message from ${name.replace(/[\r\n]+/g, " ")}`,
      text: `${name} <${email}>\n\n${message}`,
      html: emailHtml(name, email, message),
    }),
  }).catch(() => null);

  return sent?.ok ? reply(200) : reply(502, "Something went wrong sending that. Please try again.");
}
