// TEMPORARY: collects the improv buddy's debug log in dev. See src/lib/improv/debug.ts.
import { appendFile } from "node:fs/promises";
import path from "node:path";

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response(null, { status: 404 });
  const name = new URL(request.url).searchParams.get("file") === "test" ? "improv-test.log" : "improv.log";
  await appendFile(path.join(process.cwd(), ".next", name), await request.text());
  return new Response(null, { status: 204 });
}
