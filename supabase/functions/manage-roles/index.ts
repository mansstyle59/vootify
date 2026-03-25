import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, target_user_id, role } = await req.json();

    const logAction = async (details: Record<string, unknown> = {}) => {
      await adminClient.from("admin_logs").insert({
        admin_id: user.id,
        action,
        target_user_id,
        details,
      });
    };

    if (action === "promote") {
      const { error } = await adminClient.from("user_roles").upsert({
        user_id: target_user_id,
        role: role || "admin",
      }, { onConflict: "user_id,role" });
      if (error) throw error;
      await logAction({ role: role || "admin" });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "demote") {
      const { error } = await adminClient
        .from("user_roles")
        .delete()
        .eq("user_id", target_user_id)
        .eq("role", role || "admin");
      if (error) throw error;
      await logAction({ role: role || "admin" });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      // Get user info before deletion for the log
      const { data: profile } = await adminClient
        .from("profiles")
        .select("display_name")
        .eq("user_id", target_user_id)
        .single();

      await adminClient.from("profiles").delete().eq("user_id", target_user_id);
      await adminClient.from("user_roles").delete().eq("user_id", target_user_id);
      const { error } = await adminClient.auth.admin.deleteUser(target_user_id);
      if (error) throw error;
      await logAction({ deleted_user_name: profile?.display_name || "inconnu" });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
