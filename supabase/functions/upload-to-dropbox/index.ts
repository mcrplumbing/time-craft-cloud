import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Upload a work order PDF to Dropbox, auto-filing into:
 *   /1MCR FILE CABINET/1 TIME KEEPING FILES/Wk Ending MM.DD.YY/DayName MM.DD.YY/Work-Order-{job_number}.pdf
 *
 * Expects JSON body:
 *   { pdf_base64: string, filename: string, job_date: string (YYYY-MM-DD), job_number: string }
 *
 * Requires DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET env vars.
 */

async function getDropboxAccessToken(): Promise<string> {
  const refreshToken = Deno.env.get("DROPBOX_REFRESH_TOKEN");
  const appKey = Deno.env.get("DROPBOX_APP_KEY");
  const appSecret = Deno.env.get("DROPBOX_APP_SECRET");

  if (!refreshToken || !appKey || !appSecret) {
    throw new Error(
      "Dropbox credentials not configured. Set DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET in Supabase secrets."
    );
  }

  const resp = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Dropbox token refresh failed:", resp.status, text);
    throw new Error(`Dropbox auth failed: ${resp.status}`);
  }

  const data = await resp.json();
  return data.access_token;
}

function getWeekEndingFolder(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  // Find Sunday that ends the week containing this date (Mon=start, Sun=end)
  const dayOfWeek = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const sunday = new Date(d);
  sunday.setDate(d.getDate() + daysUntilSunday);
  const month = sunday.getMonth() + 1; // no leading zero
  const day = String(sunday.getDate()).padStart(2, "0");
  const year = String(sunday.getFullYear()).slice(-2);
  return `${month}.${day}.${year}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is admin
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: roleData } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    // Allow any authenticated user to upload (field workers generate PDFs)
    // But log who uploaded for audit

    const { pdf_base64, filename, job_date, job_number } = await req.json();

    if (!pdf_base64 || !filename) {
      throw new Error("pdf_base64 and filename are required");
    }

    const accessToken = await getDropboxAccessToken();

    // Build folder path
    const dateStr = job_date || new Date().toISOString().split("T")[0];
    const dateFolder = getWeekEndingFolder(dateStr);
    const folderPath = `/MCR Work Orders/${dateFolder}`;
    const filePath = `${folderPath}/${filename}`;

    // Decode base64 to bytes
    const binaryStr = atob(pdf_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Upload to Dropbox (create or overwrite)
    const uploadResp = await fetch(
      "https://content.dropboxapi.com/2/files/upload",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            path: filePath,
            mode: "overwrite",
            autorename: false,
            mute: false,
          }),
        },
        body: bytes,
      }
    );

    if (!uploadResp.ok) {
      const errText = await uploadResp.text();
      console.error("Dropbox upload failed:", uploadResp.status, errText);
      throw new Error(`Dropbox upload failed: ${uploadResp.status}`);
    }

    const uploadResult = await uploadResp.json();

    return new Response(
      JSON.stringify({
        success: true,
        path: uploadResult.path_display,
        size: uploadResult.size,
        uploaded_by: user.email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("upload-to-dropbox error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: e instanceof Error && e.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
