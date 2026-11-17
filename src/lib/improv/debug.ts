/*
  TEMPORARY: in dev, the buddy's decisions go to /api/improv-log, which appends them to .next/improv.log so
  they can be read while tuning. Does nothing in production.
*/
const enabled = process.env.NODE_ENV === "development";
const pending: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

const round = (value: unknown) => (typeof value === "number" ? Math.round(value * 1000) / 1000 : value);

export function log(event: string, data: Record<string, unknown> = {}) {
  if (!enabled) return;
  pending.push({ event, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, round(v)])) });
  timer ??= setInterval(() => {
    if (!pending.length) return;
    const lines = pending.splice(0).map((entry) => JSON.stringify(entry));
    // automated test runs open the page with ?test and log separately, so they never touch a real session
    const file = new URLSearchParams(location.search).has("test") ? "?file=test" : "";
    fetch(`/api/improv-log${file}`, { method: "POST", body: lines.join("\n") + "\n" }).catch(() => {});
  }, 1000);
}
