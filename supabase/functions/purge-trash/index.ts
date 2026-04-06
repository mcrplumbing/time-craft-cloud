import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [timeRes, woRes] = await Promise.all([
      supabase
        .from("time_entries")
        .delete()
        .not("deleted_at", "is", null)
        .lt("deleted_at", thirtyDaysAgo),
      supabase
        .from("work_orders")
        .delete()
        .not("deleted_at", "is", null)
        .lt("deleted_at", thirtyDaysAgo),
    ]);

    const result = {
      purged_time_entries: timeRes.error ? timeRes.error.message : "ok",
      purged_work_orders: woRes.error ? woRes.error.message : "ok",
      cutoff: thirtyDaysAgo,
    };

    console.log("Trash purge completed:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Purge error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
