import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user || user.email !== Deno.env.get("ALLOWED_EMAIL")) {
    return json({ error: "unauthorized" }, 403);
  }

  const { description } = await req.json();
  if (!description || typeof description !== "string" || !description.trim()) {
    return json({ error: "description required" }, 400);
  }

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: `Estimate the calorie count for this food/portion: "${description.trim()}". Respond with ONLY an integer number of kilocalories — no units, words, or punctuation.`,
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    return json({ error: "llm_request_failed" }, 502);
  }

  const data = await anthropicRes.json();
  const text = data?.content?.[0]?.text?.trim() ?? "";
  const kcal = parseInt(text.replace(/[^\d]/g, ""), 10);

  if (!Number.isFinite(kcal) || kcal <= 0) {
    return json({ error: "could_not_estimate" }, 502);
  }

  return json({ kcal });
});
