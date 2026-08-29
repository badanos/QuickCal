import { supabase } from "./supabase";

// Same load/save interface the artifact used, backed by the kv table.
// RLS scopes rows to the signed-in user; user_id defaults to auth.uid().

// A failed read must never be indistinguishable from an empty record — that is
// how a full week of entries once got overwritten with []. So reads fall back
// to a local last-known-good mirror, and throw LoadFailed when even that is
// missing. Callers must not persist anything until a load has succeeded.

const MIRROR_PREFIX = "quickcal:";

export class LoadFailed extends Error {
  constructor(key, cause) {
    super("load failed: " + key);
    this.name = "LoadFailed";
    this.key = key;
    this.cause = cause;
  }
}

function mirrorGet(key) {
  try {
    const raw = localStorage.getItem(MIRROR_PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch (e) {
    return undefined; // private mode, quota, or corrupt entry
  }
}

function mirrorSet(key, value) {
  try {
    localStorage.setItem(MIRROR_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    /* best-effort: never let mirroring break a real save */
  }
}

function mirrorKeys(prefix) {
  try {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(MIRROR_PREFIX + prefix)) out.push(k.slice(MIRROR_PREFIX.length));
    }
    return out;
  } catch (e) {
    return [];
  }
}

// Resolves to the stored value, or `fallback` when the row genuinely does not
// exist yet. Throws LoadFailed if the backend could not be read at all.
export async function load(key, fallback) {
  try {
    const { data, error } = await supabase
      .from("kv")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      mirrorSet(key, data.value);
      return data.value;
    }
    return fallback; // row absent — a new week, not a failure
  } catch (e) {
    console.error("load failed:", e);
    const cached = mirrorGet(key);
    if (cached !== undefined) return cached;
    throw new LoadFailed(key, e);
  }
}

export async function loadPrefixed(prefix) {
  try {
    const { data, error } = await supabase
      .from("kv")
      .select("key, value")
      .like("key", prefix + "%");
    if (error) throw error;
    for (const r of data || []) mirrorSet(r.key, r.value);
    return data || [];
  } catch (e) {
    console.error("loadPrefixed failed:", e);
    return mirrorKeys(prefix).map((k) => ({ key: k, value: mirrorGet(k) }));
  }
}

export async function save(key, value) {
  mirrorSet(key, value);
  try {
    const { error } = await supabase
      .from("kv")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (e) {
    console.error("save failed:", e);
  }
}

// The mirror is per-origin, not per-user; drop it on sign-out so a different
// account never reads the previous one's cached values.
export function clearMirror() {
  try {
    for (const k of mirrorKeys("")) localStorage.removeItem(MIRROR_PREFIX + k);
  } catch (e) {
    /* best-effort */
  }
}
