import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VISION_PROMPT =
  "This is a photo of a real room. Generate a realistic tidied-up version of THIS SAME room. Keep identical furniture placement, wall colors, flooring, windows, and room layout. Only remove clutter, straighten items, and make surfaces cleaner. The result must look like the same physical room — not a different room. Photorealistic. Natural lighting. Achievable level of cleanliness, not perfect.";

// Limits: authenticated users get 10 vision calls/hour, guests get 1/hour
const AUTHED_MAX = 10;
const GUEST_MAX = 1;
const WINDOW_SECONDS = 3600;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callVisionAPI(imageUrl: string, apiKey: string, attempt = 0): Promise<Response> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
      modalities: ["image", "text"],
    }),
  });

  if (response.status === 429 && attempt < 2) {
    const delay = (attempt + 1) * 3000 + attempt * 1000;
    console.log(`Rate limited. Retrying in ${delay}ms (attempt ${attempt + 1})...`);
    await sleep(delay);
    return callVisionAPI(imageUrl, apiKey, attempt + 1);
  }

  return response;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // --- Auth detection ---
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        userId = data.claims.sub;
      }
    }

    // --- Rate limiting ---
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitKey = userId
      ? `user:${userId}:generate-vision`
      : `ip:${clientIp}:generate-vision`;
    const maxCalls = userId ? AUTHED_MAX : GUEST_MAX;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: allowed, error: rlError } = await supabaseAdmin.rpc(
      "check_and_increment_rate_limit",
      {
        p_key: rateLimitKey,
        p_max_calls: maxCalls,
        p_window_seconds: WINDOW_SECONDS,
      }
    );

    if (rlError) {
      console.error("Rate limit check error:", rlError);
    } else if (allowed === false) {
      return new Response(
        JSON.stringify({
          error: userId
            ? "Too many vision requests. Please wait before trying again."
            : "Guest vision limit reached. Sign in to generate more visions.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageUrl } = await req.json();
    const response = await callVisionAPI(imageUrl, LOVABLE_API_KEY);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Vision generation is busy right now. Your challenges are ready — try generating the vision again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status} — ${errorText}`);
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const message = data.choices?.[0]?.message?.content;

    if (!generatedImage) {
      throw new Error("No image generated");
    }

    return new Response(
      JSON.stringify({
        imageUrl: generatedImage,
        message: message || "Here's your vision for the transformed space!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-vision error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
