/*
  Receives the contact form and emails it to Zach. The destination address and the mail service key exist only
  as server environment variables, so neither ever reaches the browser or the public repo.
*/
const MAX_NAME = 100;
const MAX_MESSAGE = 5000;
/** A person takes longer than this to fill in the form. */
const MIN_FILL_MS = 2000;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

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
    }),
  }).catch(() => null);

  return sent?.ok ? reply(200) : reply(502, "Something went wrong sending that. Please try again.");
}
