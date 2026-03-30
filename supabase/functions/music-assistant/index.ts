import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un assistant IA intégré dans Vootify, une application premium de streaming musique et radio.

Objectif :
- Aider l'utilisateur à découvrir de la musique
- Donner des informations sur les artistes, titres et radios
- Suggérer du contenu similaire
- Répondre de manière courte, claire et moderne

Comportement :
- Réponds toujours en français sauf si l'utilisateur demande une autre langue
- Sois rapide et précis (format mobile)
- Utilise des phrases courtes
- Si l'utilisateur demande une musique → suggère 3 à 5 titres similaires
- Si l'utilisateur demande une radio → propose des radios pertinentes avec style musical
- Si tu ne sais pas → dis-le clairement sans inventer

Ton :
- Moderne, friendly, style app premium (type Spotify / Apple Music)
- Utilise des émojis avec parcimonie (🎵 🎶 🎧 📻)

Interdictions :
- Ne jamais inventer de liens streaming illégaux
- Ne pas donner de contenu piraté
- Ne jamais donner de liens URL

Si l'utilisateur demande d'ajouter une musique manquante, génère un bloc JSON spécial :
\`\`\`music_request
{"title": "Titre", "artist": "Artiste", "notes": "Infos supplémentaires"}
\`\`\`
Puis confirme avec "✅ Demande envoyée à l'équipe !"`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessaie dans un instant." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("music-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
