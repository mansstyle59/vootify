import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es l'assistant Vootify. Ton rôle UNIQUE est d'aider les utilisateurs à demander l'ajout de musiques manquantes dans l'application.

Quand un utilisateur te demande d'ajouter une musique :
1. Confirme le titre et l'artiste
2. Demande si il a des précisions (album, année, etc.)
3. Une fois les infos confirmées, réponds avec un bloc JSON spécial que le système détectera automatiquement :
   \`\`\`music_request
   {"title": "Titre du morceau", "artist": "Nom de l'artiste", "notes": "Infos supplémentaires"}
   \`\`\`

Règles :
- Réponds TOUJOURS en français sauf si l'utilisateur parle une autre langue
- Sois amical et concis
- Si l'utilisateur demande autre chose que l'ajout de musique, redirige-le poliment vers cette fonctionnalité
- Tu peux aider à identifier une chanson si l'utilisateur ne se souvient plus du titre exact
- Utilise des émojis avec parcimonie (🎵 🎶)
- Quand tu envoies le bloc music_request, ajoute un message de confirmation comme "✅ Ta demande a été envoyée à l'admin !"`;

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
