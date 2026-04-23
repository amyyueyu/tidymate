import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTHED_MAX = 30;
const GUEST_MAX = 10;
const WINDOW_SECONDS = 3600;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Auth detection
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      if (token !== SUPABASE_ANON_KEY) {
        try {
          const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
          });
          const { data: { user } } = await supabaseAuth.auth.getUser(token);
          if (user?.id) userId = user.id;
        } catch (_) { /* guest */ }
      }
    }

    // Rate limit
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") || "unknown";
    const rateLimitKey = userId
      ? `user:${userId}:analyze-items`
      : `ip:${clientIp}:analyze-items`;
    const maxCalls = userId ? AUTHED_MAX : GUEST_MAX;

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY
    );
    const { data: allowed } = await supabaseAdmin.rpc(
      "check_and_increment_rate_limit",
      { p_key: rateLimitKey, p_max_calls: maxCalls, p_window_seconds: WINDOW_SECONDS }
    );
    if (allowed === false) {
      return new Response(
        JSON.stringify({
          error: userId
            ? "Too many requests. Please wait before trying again."
            : "Guest usage limit reached. Sign in to continue.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageUrl, intent } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "imageUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are TidyMate's KonMari Decision Coach — a warm, decisive guide who helps people overcome decision fatigue when they don't know what to do with their stuff.

Your philosophy is rooted in Marie Kondo's KonMari method, but adapted for ADHD users:
- Ask: does this item spark joy OR serve a clear, present-day purpose?
- Be DECISIVE — users came to you because they're stuck. Give one clear recommendation per item, not "it depends".
- Be KIND — never shame the user for owning anything. No "why do you have so many...".
- Be CULTURALLY AWARE — heirlooms, sentimental gifts, or culturally-significant items can be kept regardless of "joy".
- Be PRACTICAL — if an item is broken, expired, or duplicates something the user clearly uses, lean toward letting it go.

For each item you can clearly identify in the photo, decide one action:
- "keep" — sparks joy or serves a clear purpose
- "donate" — still useful, someone else could love it
- "sell" — has resale value (electronics, brand-name clothing, collectibles in good condition)
- "recycle" — broken, worn out, but materials are recyclable (paper, cardboard, e-waste, glass)
- "toss" — broken, expired, or genuinely trash with no other path

Rules:
- MAX 8 items per photo. If you see more, pick the 8 most decision-worthy ones.
- Each rationale = ONE short sentence (max 18 words). Speak directly to the user ("This shirt looks well-loved — if you haven't worn it in a year, it could spark joy for someone else.").
- Confidence: 0.0–1.0. Use lower confidence for sentimental-looking items where you can't be sure.
- name: short, recognizable label (2-4 words: "blue ceramic mug", "stack of magazines").
- visual_description: 1 sentence to help the user spot it in the pile.
- category: one of: clothing, books, electronics, kitchen, decor, paper, sentimental, toiletries, tools, toys, other.`;

    const userPrompt = intent === "single"
      ? "The user is stuck on ONE specific item in this photo. Identify it and give your KonMari recommendation."
      : "The user has a pile of items they don't know what to do with. Identify each one and give a KonMari recommendation per item.";

    const tools = [
      {
        type: "function",
        function: {
          name: "return_decisions",
          description: "Return KonMari decisions for items detected in the photo.",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    visual_description: { type: "string" },
                    category: {
                      type: "string",
                      enum: ["clothing", "books", "electronics", "kitchen", "decor", "paper", "sentimental", "toiletries", "tools", "toys", "other"],
                    },
                    suggested_action: {
                      type: "string",
                      enum: ["keep", "donate", "sell", "recycle", "toss"],
                    },
                    rationale: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: ["name", "visual_description", "category", "suggested_action", "rationale", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "return_decisions" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      throw new Error("AI did not return structured decisions");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const items = (parsed.items || []).slice(0, 8);

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-items error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
