import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function unquote(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filename) {
  const filepath = path.join(process.cwd(), filename);
  if (!existsSync(filepath)) return;

  const contents = readFileSync(filepath, "utf8");
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const cleaned = line.startsWith("export ") ? line.slice("export ".length) : line;
    const equalsIndex = cleaned.indexOf("=");
    if (equalsIndex < 0) continue;

    const key = cleaned.slice(0, equalsIndex).trim();
    const value = unquote(cleaned.slice(equalsIndex + 1).trim());
    if (!key) continue;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function deriveProjectIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (!host) return "";
    return host.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function requireString(name, value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Missing ${name}. Set it in .env.local or your shell env.`);
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const schema = (process.env.SUPABASE_SCHEMA ?? "public").trim() || "public";
const outputPath =
  (process.env.SUPABASE_TYPES_OUTPUT ?? "lib/supabase/database.types.ts").trim() ||
  "lib/supabase/database.types.ts";

const dbUrl = (process.env.SUPABASE_DB_URL ?? "").trim();

const projectId =
  process.env.SUPABASE_PROJECT_ID ??
  process.env.SUPABASE_PROJECT_REF ??
  deriveProjectIdFromUrl(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");

const safeProjectId = dbUrl ? "" : requireString("SUPABASE_PROJECT_ID (or SUPABASE_URL)", projectId);

const packagedSupabaseBin = path.join(
  process.cwd(),
  "node_modules",
  "supabase",
  "bin",
  process.platform === "win32" ? "supabase.exe" : "supabase",
);

const shimSupabaseBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "supabase.cmd" : "supabase",
);

const localSupabaseBin = existsSync(packagedSupabaseBin) ? packagedSupabaseBin : shimSupabaseBin;

const args = [
  "gen",
  "types",
  "--lang",
  "typescript",
  ...(dbUrl
    ? ["--db-url", dbUrl]
    : ["--project-id", safeProjectId]),
  "--schema",
  schema,
];

const command = existsSync(localSupabaseBin)
  ? { bin: localSupabaseBin, args }
  : null;

if (!command) {
  throw new Error("Supabase CLI not found. Run `npm install` first.");
}

const child = spawn(command.bin, command.args, {
  stdio: ["ignore", "pipe", "inherit"],
});

let stdout = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout += chunk;
});

const exitCode = await new Promise((resolve) => {
  child.on("close", resolve);
});

if (exitCode !== 0) {
  process.exit(typeof exitCode === "number" ? exitCode : 1);
}

if (!stdout.trim()) {
  throw new Error("Supabase CLI returned empty output (no types generated).");
}

await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
await writeFile(outputPath, stdout, "utf8");
console.log(`Generated Supabase types -> ${outputPath}`);
