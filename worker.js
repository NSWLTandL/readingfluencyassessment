/* ============================================================
   KS3 Reading Fluency Assessment — Cloudflare Worker
   ------------------------------------------------------------
   Receives form submissions from the website, validates them,
   then forwards the JSON to a Power Automate webhook.

   The Power Automate URL is NEVER in the front-end. It is stored
   as a Worker secret called POWER_AUTOMATE_WEBHOOK_URL
   (see README for how to add it).
   ============================================================ */

/* ----------------------------------------------------------------
   CORS
   ----------------------------------------------------------------
   For a single internal school site you can lock this down to your
   exact Pages URL by replacing "*" with e.g.
   "https://reading-fluency.pages.dev".
   ---------------------------------------------------------------- */
const ALLOWED_ORIGIN = "*";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Fields we expect from the front-end.
const REQUIRED_FIELDS = ["StudentName", "TutorGroup", "Assessor"];

const ITEM_FIELDS = [
  "TrickyWords",
  "SplitDigraphs",
  "ComplexGraphemes",
  "PolysyllabicWords",
  "Morphology",
  "Prosody",
];

const VALID_ITEM_VALUES = ["Fluent", "Challenging", "Not assessed"];

export default {
  async fetch(request, env) {
    // ---- Handle CORS preflight ----
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ---- Only allow POST ----
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // ---- Parse JSON safely ----
    let data;
    try {
      data = await request.json();
    } catch (e) {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // ---- Basic validation ----
    for (const field of REQUIRED_FIELDS) {
      if (!data[field] || String(data[field]).trim() === "") {
        return json({ error: "Missing required field: " + field }, 400);
      }
    }

    // Normalise assessment items: anything missing/invalid becomes "Not assessed".
    for (const field of ITEM_FIELDS) {
      if (!VALID_ITEM_VALUES.includes(data[field])) {
        data[field] = "Not assessed";
      }
    }

    // Ensure a timestamp exists even if the browser didn't send one.
    if (!data.Timestamp) {
      data.Timestamp = new Date().toISOString();
    }
    if (typeof data.AdviceGenerated !== "string") {
      data.AdviceGenerated = "";
    }

    // ---- Check the secret is configured ----
    if (!env.POWER_AUTOMATE_WEBHOOK_URL) {
      return json(
        { error: "Server not configured: POWER_AUTOMATE_WEBHOOK_URL is missing." },
        500
      );
    }

    // ---- Forward to Power Automate ----
    try {
      const flowRes = await fetch(env.POWER_AUTOMATE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!flowRes.ok) {
        const detail = await flowRes.text().catch(() => "");
        return json(
          { error: "Power Automate rejected the request.", status: flowRes.status, detail },
          502
        );
      }
    } catch (e) {
      return json({ error: "Could not reach Power Automate.", detail: String(e) }, 502);
    }

    // ---- Success ----
    return json({ ok: true, message: "Assessment saved." }, 200);
  },
};

/* Helper: JSON response with CORS headers attached. */
function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
