// src/App.js
import { useEffect, useMemo, useState } from "react";

function jsonPretty(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function App() {
  // Form inputs
  const [org, setOrg] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [remember, setRemember] = useState(true);

  // Data/UI state
  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState("");
  const [maxResults, setMaxResults] = useState(20);
  const [jql, setJql] = useState("");

  // Load from localStorage (org/email/projectKey only, never auto-fill token unless you want to)
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("jiraViewerCreds") || "{}");
    if (saved.org) setOrg(saved.org);
    if (saved.email) setEmail(saved.email);
    if (saved.projectKey) setProjectKey(saved.projectKey);
  }, []);

  // Keep JQL synced with project key (you can edit JQL manually too)
  useEffect(() => {
    if (projectKey.trim()) {
      setJql(`project = ${projectKey.trim().toUpperCase()} ORDER BY created DESC`);
    } else {
      setJql("");
    }
  }, [projectKey]);

  const total = useMemo(() => issues?.length ?? 0, [issues]);

  async function fetchIssues(e) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    setIssues([]);

    if (!org || !email || !token) {
      setLoading(false);
      setError("Organization, email, and API token are required.");
      return;
    }
    if (!jql) {
      setLoading(false);
      setError("Please provide a Project key or custom JQL.");
      return;
    }

    try {
      // Save a few fields locally for convenience (no token)
      if (remember) {
        localStorage.setItem(
          "jiraViewerCreds",
          JSON.stringify({ org, email, projectKey })
        );
      }

      // Call your Netlify Function: expect it to accept POST JSON and use these for Basic auth to Atlassian
      const res = await fetch("/api/jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: org,          // "<org>" part of <org>.atlassian.net
          email,
          token,
          jql,
          maxResults: Math.min(Number(maxResults || 20), 100),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Atlassian error shape: { errorMessages: [], errors: {} }
        const msg =
          data?.error ||
          (Array.isArray(data?.errorMessages) && data.errorMessages.join(", ")) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }

      setIssues(data.issues || []);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
      <h1 style={{ margin: 0 }}>Jira Ticket Queue</h1>
      <p style={{ color: "#555", marginTop: 8 }}>
        Enter your Jira Cloud details to fetch the latest issues for a project.
      </p>

      <form onSubmit={fetchIssues} style={{ display: "grid", gap: 12, margin: "16px 0" }}>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Organization (subdomain)</span>
            <input
              value={org}
              onChange={(e) => setOrg(e.target.value.trim())}
              placeholder="yourcompany"
              required
              style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            />
            <small style={{ color: "#666" }}>Full site: https://<strong>{org || "yourcompany"}</strong>.atlassian.net</small>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>API Token</span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="••••••••"
              required
              style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            />
            <small style={{ color: "#666" }}>
              Create/manage at <em>id.atlassian.com → Security → API tokens</em>
            </small>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Project Key</span>
            <input
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
              placeholder="ABC"
              style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            />
            <small style={{ color: "#666" }}>We’ll auto-build JQL with this, but you can override below.</small>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Max Results (≤ 100)</span>
            <input
              type="number"
              min="1"
              max="100"
              value={maxResults}
              onChange={(e) => setMaxResults(e.target.value)}
              style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span>JQL (optional — auto-filled from Project Key)</span>
          <input
            value={jql}
            onChange={(e) => setJql(e.target.value)}
            placeholder="project = ABC ORDER BY created DESC"
            style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Remember org/email/project key on this device</span>
        </label>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
          <button
            type="submit"
            disabled={loading}
            style={{ padding: "10px 16px", borderRadius: 8, cursor: "pointer", border: "1px solid #ddd", background: "#111", color: "white" }}
          >
            {loading ? "Fetching..." : "Fetch Issues"}
          </button>
          {error && <span style={{ color: "crimson" }}>Error: {error}</span>}
          {!error && total > 0 && (
            <span style={{ color: "#333" }}>
              <strong>{total}</strong> issue{total === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </form>

      {/* Queue (list of issues) */}
      <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
        {issues.map((issue) => {
          const fields = issue.fields || {};
          const summary = fields.summary || "(no summary)";
          const status = fields.status?.name || "(no status)";
          const assignee = fields.assignee?.displayName || "Unassigned";
          const created = fields.created ? formatDate(fields.created) : "";
          const url = issue.self?.replace(/\/rest\/api\/3\/issue\/.*/, `/browse/${issue.key}`);

          return (
            <li key={issue.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <a href={url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, textDecoration: "none" }}>
                    {issue.key}
                  </a>{" "}
                  — {summary}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ padding: "2px 10px", border: "1px solid #ddd", borderRadius: 999 }}>{status}</span>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "#555" }}>
                Assignee: {assignee} &middot; Created: {created}
              </div>

              {/* All fields, collapsible */}
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: "pointer" }}>Show all fields (raw JSON)</summary>
                <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", background: "#f8fafc", padding: 12, borderRadius: 8, marginTop: 8 }}>
                  {jsonPretty(fields)}
                </pre>
              </details>
            </li>
          );
        })}
      </ul>

      {!loading && total === 0 && !error && (
        <div style={{ color: "#666", marginTop: 12 }}>No issues to display yet.</div>
      )}

      <hr style={{ marginTop: 24 }} />
      <p style={{ color: "#666", fontSize: 13 }}>
        Tip: Use JQL like <code>assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC</code>.
      </p>
    </div>
  );
}
