// netlify/functions/jira.js

// CORS: lock this down to your site origin in production.
const ALLOW_ORIGIN = "*";

export async function handler(event) {
  try {
    // CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: corsHeaders(),
        body: "",
      };
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method Not Allowed. Use POST." });
    }

    // Parse input
    let bodyIn;
    try {
      bodyIn = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const {
      domain,       // "<org>" part of <org>.atlassian.net
      email,        // Atlassian account email
      token,        // Atlassian API token
      jql,          // e.g., "project = ABC ORDER BY created DESC"
      maxResults = 20,
    } = bodyIn;

    // Validate
    if (!domain || !email || !token) {
      return json(400, { error: "Missing required fields: domain, email, token" });
    }
    if (!jql || typeof jql !== "string") {
      return json(400, { error: "JQL is required" });
    }

    // Construct request to Jira
    const auth = Buffer.from(`${email}:${token}`).toString("base64");
    const url = `https://${domain}.atlassian.net/rest/api/3/search`;

    const reqBody = {
      jql,
      maxResults: clampInt(maxResults, 1, 100),
      // Ask for all fields; trim this list for speed if needed.
      fields: ["*all"],
      // expand: ["names", "schema", "renderedFields"], // optional
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });

    // Jira returns JSON on success AND error
    let data;
    try {
      data = await res.json();
    } catch {
      // Rare, but handle non-JSON responses
      data = { raw: await res.text() };
    }

    if (!res.ok) {
      const message =
        data?.error ||
        (Array.isArray(data?.errorMessages) && data.errorMessages.join(", ")) ||
        `Jira error HTTP ${res.status}`;
      return json(res.status, { error: message, details: data });
    }

    return json(200, data);
  } catch (err) {
    return json(500, { error: err?.message || "Server error" });
  }
}

// Helpers
function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
    body: JSON.stringify(obj),
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function clampInt(value, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
