import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Re-sync a work order: re-parses labor data and pushes to Google Sheets.
 * Admin-only action.
 *
 * Expects JSON body:
 *   { work_order_id: string }
 *
 * Flow:
 *   1. Fetch the work order from the database
 *   2. Call the mcr-time-tracking parse-labor edge function to re-parse
 *   3. Call the mcr-time-tracking push-to-sheets edge function to push
 *   4. Optionally upload updated PDF to Dropbox
 *
 * Requires MCR_TIME_TRACKING_URL env var (the Supabase URL for the time-tracking project).
 * Requires MCR_TIME_TRACKING_ANON_KEY env var.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: admin only ──
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await sb.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: roleData } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { work_order_id } = await req.json();
    if (!work_order_id) throw new Error("work_order_id is required");

    // ── Fetch work order ──
    const { data: order, error: orderError } = await sb
      .from("work_orders")
      .select("*")
      .eq("id", work_order_id)
      .maybeSingle();

    if (orderError || !order) throw new Error("Work order not found");

    // ── Build work order text for parsing ──
    // The description field contains the full work order text
    const workOrderText = [
      `Job#${order.job_number || order.order_number} - ${order.job_date || ""}`,
      "",
      order.description || "",
    ].join("\n");

    const results: {
      parse?: any;
      sheets?: any;
      errors: string[];
    } = { errors: [] };

    // ── Step 1: Parse labor via mcr-time-tracking ──
    const timeTrackingUrl = Deno.env.get("MCR_TIME_TRACKING_URL");
    const timeTrackingKey = Deno.env.get("MCR_TIME_TRACKING_ANON_KEY");

    if (!timeTrackingUrl || !timeTrackingKey) {
      results.errors.push(
        "MCR_TIME_TRACKING_URL or MCR_TIME_TRACKING_ANON_KEY not configured — skipping parse & sheets push"
      );
    } else {
      try {
        // Call parse-labor
        const parseResp = await fetch(
          `${timeTrackingUrl}/functions/v1/parse-labor`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${timeTrackingKey}`,
              apikey: timeTrackingKey,
            },
            body: JSON.stringify({ workOrders: workOrderText }),
          }
        );

        if (!parseResp.ok) {
          const errText = await parseResp.text();
          results.errors.push(`Parse-labor failed: ${parseResp.status} ${errText}`);
        } else {
          results.parse = await parseResp.json();

          // ── Step 2: Push to Google Sheets ──
          const workOrders = results.parse?.work_orders || [];
          if (workOrders.length > 0) {
            // Flatten entries for push-to-sheets
            const entries = workOrders.flatMap((wo: any) =>
              (wo.entries || []).map((e: any) => ({
                job_number: wo.job_number,
                date: wo.date,
                day_of_week: wo.day_of_week,
                employee_name: e.employee_name,
                hours: e.hours,
                type: e.type,
              }))
            );

            if (entries.length > 0) {
              const sheetsResp = await fetch(
                `${timeTrackingUrl}/functions/v1/push-to-sheets`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${timeTrackingKey}`,
                    apikey: timeTrackingKey,
                  },
                  body: JSON.stringify({ entries }),
                }
              );

              if (!sheetsResp.ok) {
                const errText = await sheetsResp.text();
                results.errors.push(`Push-to-sheets failed: ${sheetsResp.status} ${errText}`);
              } else {
                results.sheets = await sheetsResp.json();
              }
            } else {
              results.errors.push("No labor entries parsed — nothing to push to sheets");
            }
          } else {
            results.errors.push("No work orders parsed from description text");
          }
        }
      } catch (e) {
        results.errors.push(`Time tracking sync error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        work_order_id,
        job_number: order.job_number,
        parse_summary: results.parse?.summary || null,
        parse_flags: results.parse?.flags || [],
        sheets_result: results.sheets || null,
        errors: results.errors,
        synced_by: user.email,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("resync-work-order error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: msg === "Unauthorized" ? 401 : msg === "Admin access required" ? 403 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
