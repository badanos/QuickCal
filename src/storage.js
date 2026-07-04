import { supabase } from "./supabase";

// Same load/save interface the artifact used, backed by the kv table.
// RLS scopes rows to the signed-in user; user_id defaults to auth.uid().

const mem = {}; // in-memory fallback so the UI never blocks on network errors

export async function load(key, fallback) {
  try {
    const { data, error } = await supabase
      .from("kv")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      mem[key] = data.value;
      return data.value;
    }
  } catch (e) {
    console.error("load failed:", e);
    if (key in mem) return mem[key];
  }
  return fallback;
}

export async function save(key, value) {
  mem[key] = value;
  try {
    const { error } = await supabase
      .from("kv")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  } catch (e) {
    console.error("save failed:", e);
  }
}
