import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROGRESS_MAX = 10;
const WINDOW_SECONDS = 3600;

const FALLBACK = {
  praise: "Look at what you did — real, actual progress.",
  bonusPoints: 20,
  progressLabel: "Progress made",
  shareTagline: "I tidied my space with TidyMate",
  shareReactionPill: "ADHD win unlocked",
  shareSub: "Something shifted today. Might clean again next year.",
};

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

    // Auth detection
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

    // Rate limiting
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitKey = userId
      ? `progress:${userId}`
      : `progress:ip:${clientIp}`;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: allowed, error: rlError } = await supabaseAdmin.rpc(
      "check_and_increment_rate_limit",
      {
        p_key: rateLimitKey,
        p_max_calls: PROGRESS_MAX,
        p_window_seconds: WINDOW_SECONDS,
      }
    );

    if (rlError) {
      console.error("Rate limit check error:", rlError);
    } else if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "Progress photo limit reached. Please wait before trying again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageUrl, beforeImageUrl, intent, completedChallenges, totalChallenges, roomName } = await req.json();

    const systemPrompt = `You are TidyMate — a warm, encouraging AI companion for ADHD users.
The user just uploaded a progress photo of their space mid-session or after finishing.
You can see both their before photo and their current progress photo.
Your job: notice specific visible improvements and celebrate them genuinely.
Be warm, concrete, and real. Never use the words: amazing, incredible, fantastic, awesome.
Notice what actually changed — even small things count. Make the user feel seen and capable.
Respond ONLY with valid JSON, no markdown, no preamble.
{
  "praise": "2-3 warm sentences describing what you notice changed. Specific wins only.",
  "bonusPoints": number between 15 and 50 based on how much visible progress was made,
  "progressLabel": "Short celebration label, max 5 words. E.g. Real progress made / Space is breathing / Floor is visible",
  "shareTagline": "First-person past-tense sentence max 12 words. E.g. I cleared my desk in 20 minutes with TidyMate"
}`;

    const userPrompt = `Room: "${roomName}"
Intent: ${intent}
Challenges completed: ${completedChallenges} of ${totalChallenges}

Compare the before photo (left/first) with the progress photo (right/second).
Notice what specifically changed. Celebrate the concrete visible wins.
Return valid JSON only.`;

    const messageContent: any[] = [
      { type: "text", text: userPrompt },
    ];

    // Add before image if available
    if (beforeImageUrl) {
      messageContent.push({ type: "image_url", image_url: { url: beforeImageUrl } });
    }

    // Add progress/after image
    messageContent.push({ type: "image_url", image_url: { url: imageUrl } });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messageContent },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return new Response(JSON.stringify(FALLBACK), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
        // Clamp bonusPoints
        result.bonusPoints = Math.max(15, Math.min(50, Number(result.bonusPoints) || 20));
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      console.error("Failed to parse AI response:", content);
      result = FALLBACK;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-progress error:", error);
    return new Response(JSON.stringify(FALLBACK), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
