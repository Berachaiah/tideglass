import { createServerFn } from "@tanstack/react-start";

// Case insensitive login, configured only from the environment: ADMIN_LOGINS
// (comma separated) and ADMIN_PASSWORD. With either unset nobody can sign in —
// there is deliberately no fallback, because this repository is public.
const TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILS = 6;
const BLOCK_MS = 10 * 60 * 1000;

const fails = new Map<string, { n: number; until: number }>();

function expected() {
  const logins = (process.env.ADMIN_LOGINS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const password = (process.env.ADMIN_PASSWORD ?? "").trim().toLowerCase();
  return { logins, password, configured: logins.length > 0 && password.length > 0 };
}

async function same(a: string, b: string) {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

async function sign(exp: number, key: string) {
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", `tideglass|${key}`).update(String(exp)).digest("hex");
}

export async function requireAdmin(token: unknown) {
  const { password } = expected();
  // An unset password would mean signing with a key anyone can reproduce, so
  // refuse every token instead.
  if (!password) throw new Error("Locked");
  const text = typeof token === "string" ? token : "";
  const [expText, mac] = text.split(".");
  const exp = Number(expText);
  if (!Number.isFinite(exp) || !mac || exp < Date.now()) throw new Error("Locked");
  if (!(await same(mac, await sign(exp, password)))) throw new Error("Locked");
}

function cleanLogin(input: { login: string; password: string }) {
  return {
    login: String(input?.login ?? "").slice(0, 120),
    password: String(input?.password ?? "").slice(0, 120),
  };
}

export const adminLogin = createServerFn({ method: "POST" })
  .validator(cleanLogin)
  .handler(async ({ data }): Promise<{ ok: true; token: string } | { ok: false; error: string }> => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const forwarded = getRequestHeader("x-forwarded-for") ?? "";
    const ip = forwarded.split(",")[0]?.trim() || "unknown";
    const record = fails.get(ip);
    if (record && record.until > Date.now()) {
      return { ok: false, error: "Too many tries. Wait a few minutes." };
    }
    const want = expected();
    if (!want.configured) {
      return { ok: false, error: "Admin sign-in is not configured for this deployment." };
    }
    const loginOk = want.logins.includes(data.login.trim().toLowerCase());
    const passOk = await same(data.password.trim().toLowerCase(), want.password);
    if (!loginOk || !passOk) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const n = (record?.n ?? 0) + 1;
      fails.set(ip, { n, until: n >= MAX_FAILS ? Date.now() + BLOCK_MS : 0 });
      return { ok: false, error: "Wrong login or password." };
    }
    fails.delete(ip);
    const exp = Date.now() + TTL_MS;
    return { ok: true, token: `${exp}.${await sign(exp, want.password)}` };
  });
