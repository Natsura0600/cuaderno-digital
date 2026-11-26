/**
 * Conexión a la base de datos.
 * - En Vercel usa Upstash Redis (variables KV_REST_API_URL/KV_REST_API_TOKEN que crea la integración,
 *   o UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN si la base se creó directamente en Upstash).
 * - En una computadora sin Upstash usa un Redis local (REDIS_URL, por defecto redis://localhost:6379).
 */
import { Redis as Upstash } from "@upstash/redis";

export interface KV {
  hgetall(key: string): Promise<Record<string, string>>;
  hget(key: string, field: string): Promise<string | null>;
  hmget(key: string, fields: string[]): Promise<(string | null)[]>;
  hset(key: string, values: Record<string, string>): Promise<void>;
  hdel(key: string, fields: string[]): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(keys: string[]): Promise<void>;
  incrby(key: string, n: number): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

const restUrl = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const restToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

function upstash(): KV {
  const r = new Upstash({ url: restUrl!, token: restToken!, automaticDeserialization: false, enableAutoPipelining: true });
  const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
  return {
    async hgetall(k) {
      // Sin deserialización automática Upstash devuelve [campo, valor, campo, valor…]
      const h = (await r.hgetall(k)) as unknown;
      if (!h) return {};
      if (Array.isArray(h)) {
        const out: Record<string, string> = {};
        for (let i = 0; i < h.length; i += 2) out[String(h[i])] = String(h[i + 1]);
        return out;
      }
      return Object.fromEntries(Object.entries(h as Record<string, unknown>).map(([f, v]) => [f, String(v)]));
    },
    hget: async (k, f) => str(await r.hget(k, f)),
    async hmget(k, fs) {
      if (!fs.length) return [];
      const h = (await r.hmget(k, ...fs)) as unknown;
      if (Array.isArray(h)) return h.map(str);
      return fs.map((f) => str((h as Record<string, unknown> | null)?.[f]));
    },
    async hset(k, v) {
      const entries = Object.entries(v);
      for (let i = 0; i < entries.length; i += 500) await r.hset(k, Object.fromEntries(entries.slice(i, i + 500)));
    },
    async hdel(k, fs) {
      if (fs.length) await r.hdel(k, ...fs);
    },
    get: async (k) => str(await r.get(k)),
    async set(k, v) {
      await r.set(k, v);
    },
    async del(ks) {
      for (let i = 0; i < ks.length; i += 500) if (ks.slice(i, i + 500).length) await r.del(...ks.slice(i, i + 500));
    },
    incrby: (k, n) => r.incrby(k, n),
    async keys(pattern) {
      const out: string[] = [];
      let cursor: string | number = 0;
      do {
        const [next, ks]: [string, string[]] = await r.scan(cursor, { match: pattern, count: 1000 });
        out.push(...ks);
        cursor = next;
      } while (String(cursor) !== "0");
      return out;
    },
  };
}

function local(): KV {
  type Cliente = Awaited<ReturnType<typeof crear>>;
  async function crear() {
    const { createClient } = await import("redis");
    const c = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
    c.on("error", (e) => console.error("Redis:", e.message));
    await c.connect();
    return c;
  }
  const g = globalThis as unknown as { __redisLocal?: Promise<Cliente> };
  const c = () => (g.__redisLocal ??= crear());
  return {
    hgetall: async (k) => (await c()).hGetAll(k) as Promise<Record<string, string>>,
    hget: async (k, f) => ((await (await c()).hGet(k, f)) as string | null) ?? null,
    hmget: async (k, fs) => (fs.length ? ((await (await c()).hmGet(k, fs)) as (string | null)[]) : []),
    async hset(k, v) {
      if (Object.keys(v).length) await (await c()).hSet(k, v);
    },
    async hdel(k, fs) {
      if (fs.length) await (await c()).hDel(k, fs);
    },
    get: async (k) => ((await (await c()).get(k)) as string | null) ?? null,
    async set(k, v) {
      await (await c()).set(k, v);
    },
    async del(ks) {
      if (ks.length) await (await c()).del(ks);
    },
    incrby: async (k, n) => (await c()).incrBy(k, n),
    keys: async (p) => (await c()).keys(p),
  };
}

export const usaUpstash = Boolean(restUrl && restToken);
/** En Vercel sin Upstash conectado no hay base: las páginas muestran cómo conectarla. */
export const baseConfigurada = usaUpstash || !process.env.VERCEL;

function sinBase(): KV {
  const error = async (): Promise<never> => {
    throw new Error("Falta conectar la base de datos Upstash Redis al proyecto de Vercel (variables KV_REST_API_URL y KV_REST_API_TOKEN).");
  };
  return { hgetall: error, hget: error, hmget: error, hset: error, hdel: error, get: error, set: error, del: error, incrby: error, keys: error };
}

export const kv: KV = usaUpstash ? upstash() : baseConfigurada ? local() : sinBase();
