 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { imageUrl, intent, timeAvailable } = await req.json();
     const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
     
     if (!LOVABLE_API_KEY) {
       throw new Error("LOVABLE_API_KEY is not configured");
     }
 
     const systemPrompt = `You are TidyMind, an ADHD-friendly assistant that helps people declutter and organize their spaces. You are encouraging, supportive, and break down tasks into small, achievable micro-challenges.
 
 Analyze the room image and create personalized challenges based on the user's intent. Remember:
 - Keep instructions SIMPLE and SINGLE-ACTION
 - Each challenge should be 5-10 minutes max
 - Use encouraging, friendly language
 - Focus on quick wins to build momentum
 - Avoid overwhelming the user with too many steps at once`;
 
     const intentDescriptions: Record<string, string> = {
       tidy: "focusing on putting things back in their places and creating a neat appearance",
       declutter: "focusing on identifying items to remove, donate, or discard",
       redesign: "focusing on reorganizing the space for better functionality and aesthetics"
     };
 
     const userPrompt = `Analyze this room image and create a set of ADHD-friendly micro-challenges for someone who wants to ${intent} their space (${intentDescriptions[intent] || intentDescriptions.tidy}).
 
 ${timeAvailable ? `They have approximately ${timeAvailable} minutes available.` : ""}
 
 Create 4-8 specific, actionable challenges. For each challenge, provide:
 1. A clear, single-action title (max 8 words)
 2. A brief encouraging description (1-2 sentences)
 3. Estimated time in minutes (5-10 min each)
 4. Points value (10-30 based on effort)
 
 Respond in JSON format:
 {
   "roomName": "descriptive name for this space",
   "challenges": [
     {
       "title": "Clear the coffee table",
       "description": "Start with the most visible surface. You've got this!",
       "timeEstimate": 5,
       "points": 15
     }
   ],
   "encouragement": "A brief motivational message for the user"
 }`;
 
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
           {
             role: "user",
             content: [
               { type: "text", text: userPrompt },
               { type: "image_url", image_url: { url: imageUrl } }
             ]
           }
         ],
       }),
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
       throw new Error(`AI gateway error: ${response.status}`);
     }
 
     const data = await response.json();
     const content = data.choices?.[0]?.message?.content;
     
     // Parse JSON from the response
     let result;
     try {
       // Try to extract JSON from the response
       const jsonMatch = content.match(/\{[\s\S]*\}/);
       if (jsonMatch) {
         result = JSON.parse(jsonMatch[0]);
       } else {
         throw new Error("No JSON found in response");
       }
     } catch (parseError) {
       console.error("Failed to parse AI response:", content);
       throw new Error("Failed to parse AI response");
     }
 
     return new Response(JSON.stringify(result), {
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error) {
     console.error("analyze-room error:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });