import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VISION_PROMPT =
  "This is a photo of a real room. Generate a realistic tidied-up version of THIS SAME room. Keep identical furniture placement, wall colors, flooring, windows, and room layout. Only remove clutter, straighten items, and make surfaces cleaner. The result must look like the same physical room — not a different room. Photorealistic. Natural lighting. Achievable level of cleanliness, not perfect.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch the original room image and convert to a Blob for multipart upload
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch source image: ${imageRes.status}`);
    }
    const imageBlob = await imageRes.blob();
    const contentType = imageBlob.type || "image/jpeg";
    const extension = contentType.split("/")[1] || "jpg";

    // Build multipart form data for gpt-image-1 edits endpoint
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("prompt", VISION_PROMPT);
    formData.append("image[]", new File([imageBlob], `room.${extension}`, { type: contentType }));
    formData.append("n", "1");
    formData.append("size", "1024x1024");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        // Do NOT set Content-Type — browser/fetch sets it automatically with the boundary
      },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
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
    // gpt-image-1 returns base64 by default; url if output_format requested
    const imageData = data.data?.[0];
    if (!imageData) {
      throw new Error("No image returned from gpt-image-1");
    }

    const generatedImageUrl = imageData.url
      ? imageData.url
      : `data:image/png;base64,${imageData.b64_json}`;

    return new Response(
      JSON.stringify({
        imageUrl: generatedImageUrl,
        message: "Here's your vision for the transformed space!",
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
