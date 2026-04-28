import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VISION_PROMPT =
  "This is a photo of a real room. Generate a realistic tidied-up version of THIS SAME room. Keep identical furniture placement, wall colors, flooring, windows, and room layout. Only remove clutter, straighten items, and make surfaces cleaner. The result must look like the same physical room — not a different room. Photorealistic. Natural lighting. Achievable level of cleanliness, not perfect.";

// Limits: authenticated users get 10 vision calls/hour, guests get 5/hour
const AUTHED_MAX = 10;
const GUEST_MAX = 5;
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // --- Auth detection (fix: use getUser instead of getClaims) ---
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      // Skip JWT decode for anon key (it's not a user token)
      if (token !== SUPABASE_ANON_KEY) {
        try {
          const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
          });
          const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
          if (!error && user?.id) {
            userId = user.id;
          }
        } catch (authErr) {
          console.warn("Auth check failed, treating as guest:", authErr);
        }
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

    // Use service role key for rate limit RPC to avoid RLS issues
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);
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
      // Don't block on rate limit errors — fail open
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

    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating vision for ${userId ? `user ${userId}` : "guest"}, image type: ${imageUrl.startsWith("data:") ? "base64" : "url"}`);

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
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      throw new Error("No image generated");
    }

    // Upload base64 -> storage so the client gets a small CDN URL (not a 2MB data URL).
    // This dramatically reduces payload size, render lag, and DB row size.
    let finalImageUrl = generatedImage;
    try {
      if (typeof generatedImage === "string" && generatedImage.startsWith("data:")) {
        const match = generatedImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          const mime = match[1];
          const ext = mime.split("/")[1] || "png";
          const b64 = match[2];
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const folder = userId ?? "guest";
          const fileName = `${folder}/vision-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

          const { error: uploadErr } = await supabaseAdmin.storage
            .from("room-images")
            .upload(fileName, bytes, {
              contentType: mime,
              cacheControl: "31536000",
              upsert: false,
            });

          if (uploadErr) {
            console.warn("Vision upload failed, falling back to data URL:", uploadErr);
          } else {
            const { data: pub } = supabaseAdmin.storage
              .from("room-images")
              .getPublicUrl(fileName);
            if (pub?.publicUrl) finalImageUrl = pub.publicUrl;
          }
        }
      }
    } catch (uploadEx) {
      console.warn("Vision upload exception, falling back to data URL:", uploadEx);
    }

    return new Response(
      JSON.stringify({
        imageUrl: finalImageUrl,
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
