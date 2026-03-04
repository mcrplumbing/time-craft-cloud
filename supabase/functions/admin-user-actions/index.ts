import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, target_user_id, full_name, role } = body;

    if (action === "update_profile") {
      // Update profile name
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ full_name })
        .eq("user_id", target_user_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      // Upsert role
      const { error: delError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", target_user_id);
      if (delError) throw delError;

      if (role !== "user") {
        // Only insert if not default "user" role
        const { error: insError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: target_user_id, role });
        if (insError) throw insError;
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_password_reset") {
      // Get user email
      const { data: { user: targetUser }, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(target_user_id);
      if (getUserErr || !targetUser?.email) throw new Error("User not found");

      // Use the admin API to generate a recovery link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: targetUser.email,
      });
      if (linkError) throw linkError;

      // Send the reset email via the standard flow
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(targetUser.email, {
        redirectTo: `${req.headers.get("origin") || "https://time-craft-cloud.lovable.app"}/reset-password`,
      });
      if (resetError) throw resetError;

      return new Response(JSON.stringify({ success: true, email: targetUser.email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
