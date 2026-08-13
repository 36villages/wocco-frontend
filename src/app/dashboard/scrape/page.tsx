"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import {
  WOCCO_SERVICE_GROUPS,
  WOCCO_SERVICES,
  findWoccoService,
} from "@/lib/wocco-services";

type ScrapeStatus = "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMED-OUT" | "ABORTED";

interface ScrapeRun {
  runId: string;
  status: ScrapeStatus;
  source?: string;
  target?: string;
}

interface ImportResult {
  imported: number;
  scraped: number;
  skipped: number;
  skippedDuplicates?: number;
  skippedNoContact?: number;
  skippedJunk?: number;
  skippedIrrelevant?: number;
  batchId?: string;
  message?: string;
}

const STATUS_COLORS: Record<string, string> = {
  READY: "#60a5fa",
  RUNNING: "#fbbf24",
  SUCCEEDED: "#34d399",
  FAILED: "#ef4444",
  "TIMED-OUT": "#ef4444",
  ABORTED: "#6b7280",
};

function queryForService(
  svc: { name: string; search: string },
  source: string,
) {
  // People Finder is job-title based; Google Maps gets skill-accurate trade queries
  if (source === "people") return svc.search;
  if (source === "google") {
    // Prefer catalog search term (e.g. "AC Installer") — backend sharpens it further
    return svc.search || svc.name;
  }
  return svc.name;
}

export default function ScrapePage() {
  const router = useRouter();
  const [target, setTarget] = useState<"business" | "individual">("business");
  const [source, setSource] = useState("google");
  const [serviceId, setServiceId] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [maxResults, setMaxResults] = useState(50);
  const [isNarrow, setIsNarrow] = useState(false);

  const [run, setRun] = useState<ScrapeRun | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [importing, setImporting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push("/login");
      return;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function applyTarget(next: "business" | "individual") {
    setTarget(next);
    const nextSource = next === "individual" ? "people" : "google";
    setSource(nextSource);
    setMaxResults(50);
    if (serviceId) {
      const svc = findWoccoService(serviceId);
      if (svc) setQuery(queryForService(svc, nextSource));
    }
  }

  function applyService(id: string) {
    setServiceId(id);
    const svc = findWoccoService(id);
    if (svc) setQuery(queryForService(svc, source));
  }

  function applySource(next: string) {
    setSource(next);
    setMaxResults(next === "craigslist" ? 20 : 50);
    if (serviceId) {
      const svc = findWoccoService(serviceId);
      if (svc) setQuery(queryForService(svc, next));
    }
  }

  const filteredGroups = useMemo(() => {
    const q = serviceFilter.trim().toLowerCase();
    if (!q) return WOCCO_SERVICE_GROUPS;
    return WOCCO_SERVICE_GROUPS.map((g) => ({
      ...g,
      services: g.services.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.search.toLowerCase().includes(q),
      ),
    })).filter((g) => g.services.length > 0);
  }, [serviceFilter]);

  const selectedService = serviceId ? findWoccoService(serviceId) : undefined;
  // Keep select value valid when filter hides the current option
  const selectValue =
    selectedService &&
    filteredGroups.some((g) => g.services.some((s) => s.id === serviceId))
      ? serviceId
      : "";

  function startPolling(runId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/scraper/runs/${runId}`);
        setRun((prev) => (prev ? { ...prev, ...res.data } : res.data));
        if (["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"].includes(res.data.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 5000);
  }

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setImportResult(null);
    setStarting(true);
    try {
      const res = await api.post("/scraper/run", {
        target,
        source,
        query,
        location,
        maxResults,
      });
      setRun(res.data);
      startPolling(res.data.runId);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to start scrape"));
    } finally {
      setStarting(false);
    }
  }

  async function handleImport() {
    if (!run) return;
    setImporting(true);
    setError("");
    try {
      // Prefer clean service display name for serviceCategory (not rewritten job title)
      const category = selectedService?.name || query;
      const res = await api.post(`/scraper/runs/${run.runId}/import`, {
        source: run.source || source,
        target: run.target || target,
        query: category,
      });
      setImportResult(res.data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Import failed"));
    } finally {
      setImporting(false);
    }
  }

  const statusColor = (run?.status ? STATUS_COLORS[run.status] : undefined) || "#9ca3af";
  const inputStyle = {
    width: "100%",
    background: "#1f2937",
    border: "1px solid #374151",
    color: "white",
    borderRadius: "8px",
    padding: "10px 12px",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box" as const,
  };
  const labelStyle = {
    color: "#9ca3af",
    fontSize: "12px",
    fontWeight: "600" as const,
    display: "block",
    marginBottom: "6px",
  };
  const twoCol = {
    display: "grid",
    gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
    gap: isNarrow ? "10px" : "12px",
    marginBottom: "16px",
  } as const;

  return (
    <>
      <header
        style={{
          background: "#111827",
          borderBottom: "1px solid #1f2937",
          padding: isNarrow ? "14px 16px" : "16px 24px",
          flexShrink: 0,
        }}
      >
        <h2 style={{ color: "white", fontWeight: "600", fontSize: "15px", margin: 0 }}>Lead Scraper</h2>
        <p style={{ color: "#6b7280", fontSize: "11px", margin: "2px 0 0" }}>
          Scrape people or businesses — imported leads keep their identity
        </p>
      </header>

      <main
        style={{
          flex: 1,
          overflow: "auto",
          padding: isNarrow ? "16px" : "24px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            maxWidth: "720px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxSizing: "border-box",
          }}
        >
          <form
            onSubmit={handleStart}
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "16px",
              padding: isNarrow ? "16px" : "24px",
              minWidth: 0,
            }}
          >
            <h3 style={{ color: "white", fontWeight: "600", fontSize: "14px", margin: "0 0 20px" }}>New Scrape</h3>

            <div style={twoCol}>
              {(
                [
                  {
                    key: "individual" as const,
                    title: "Individual",
                    desc: "Person identity: name, email, phone, role",
                  },
                  {
                    key: "business" as const,
                    title: "Business",
                    desc: "Company listing: name, phone, address, category",
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => applyTarget(option.key)}
                  style={{
                    textAlign: "left",
                    background: target === option.key ? "rgba(37,99,235,0.18)" : "#1f2937",
                    border: `1px solid ${target === option.key ? "#2563eb" : "#374151"}`,
                    borderRadius: "12px",
                    padding: "14px",
                    cursor: "pointer",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <p style={{ color: "white", fontWeight: 700, fontSize: "13px", margin: 0 }}>{option.title}</p>
                  <p style={{ color: "#9ca3af", fontSize: "11px", margin: "6px 0 0", lineHeight: 1.4 }}>{option.desc}</p>
                </button>
              ))}
            </div>

            <div style={{ marginBottom: "16px", minWidth: 0 }}>
              <label style={labelStyle}>Service</label>
              <input
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                placeholder={`Filter ${WOCCO_SERVICES.length} services…`}
                style={{ ...inputStyle, marginBottom: "8px" }}
              />
              <select
                value={selectValue}
                onChange={(e) => applyService(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select a service...</option>
                {filteredGroups.map((g) => (
                  <optgroup key={g.group} label={g.label}>
                    {g.services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p style={{ color: "#6b7280", fontSize: "11px", margin: "8px 0 0", lineHeight: 1.45 }}>
                Individuals → People Finder · Businesses → Google Maps · Craigslist optional
              </p>
            </div>

            <div style={{ ...twoCol, gap: isNarrow ? "16px" : "16px" }}>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>Source</label>
                <select
                  value={source}
                  onChange={(e) => applySource(e.target.value)}
                  style={inputStyle}
                >
                  {target === "individual" ? (
                    <>
                      <option value="people">People Finder (name + email + phone)</option>
                      <option value="craigslist">Craigslist owners (listings + photos)</option>
                    </>
                  ) : (
                    <>
                      <option value="google">Google Maps (businesses)</option>
                      <option value="craigslist">Craigslist services</option>
                    </>
                  )}
                </select>
              </div>
              <div style={{ minWidth: 0 }}>
                <label style={labelStyle}>Max Results</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxResults}
                  onChange={(e) => setMaxResults(parseInt(e.target.value) || 50)}
                  style={inputStyle}
                />
                {source === "people" && (
                  <p style={{ color: "#6b7280", fontSize: "11px", margin: "8px 0 0", lineHeight: 1.45 }}>
                    Sparse trades (junk/trash): try 50–100. Cap is 100 per run.
                  </p>
                )}
              </div>
            </div>

            <div style={{ marginBottom: "16px", minWidth: 0 }}>
              <label style={labelStyle}>
                {source === "people" ? "Job title / role" : "Search Query"}
              </label>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  // Clear service selection if user edits away from catalog string
                  if (
                    selectedService &&
                    e.target.value !== queryForService(selectedService, source)
                  ) {
                    setServiceId("");
                  }
                }}
                placeholder={
                  source === "people"
                    ? 'e.g. "House Cleaner" or "Junk Remover"'
                    : target === "individual"
                      ? 'e.g. "House Cleaner" or "Junk Removal"'
                      : 'e.g. "House Cleaning" or "HVAC Technician"'
                }
                required
                style={inputStyle}
              />
              {source === "people" && (
                <p style={{ color: "#6b7280", fontSize: "11px", margin: "8px 0 0", lineHeight: 1.45 }}>
                  {selectedService?.peopleTitleHint
                    ? selectedService.peopleTitleHint
                    : "People Finder needs job titles (e.g. House Cleaner), not company marketing phrases like “Trash Removal”."}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "8px", minWidth: 0 }}>
              <label style={labelStyle}>
                {source === "craigslist"
                  ? "City subdomain (e.g. dallas, honolulu — not a state name)"
                  : source === "people"
                    ? "Location (city, or state like texas)"
                    : "Location (required)"}
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={
                  source === "craigslist"
                    ? "dallas or honolulu (city site — not Hawaii / Texas)"
                    : source === "people"
                      ? 'e.g. "Dallas" or "texas" or "texas, us"'
                      : "e.g. Miami, FL — also searches nearby metro cities"
                }
                required={source === "google"}
                style={inputStyle}
              />
            </div>

            <p style={{ color: "#4b5563", fontSize: "11px", margin: "0 0 20px", lineHeight: 1.5 }}>
              {source === "people" &&
                "Uses Apify People Finder (~$1.50 / 1,000). Junk/trash searches expand to related titles; email status is not limited to validated-only (import still requires phone or email). State names like “texas” map to texas, us; cities like “dallas” use city filter."}
              {source === "google" &&
                "Uses Google Maps. Searches your city plus nearby metro areas. Import keeps businesses that match the selected skill (title + Google category). Check “Listed as” on each lead — that is their real trade."}
              {source === "craigslist" &&
                target === "individual" &&
                "Owner listings: goods → for-sale, service queries (trash, cleaning, plumbing…) → services. Use a city subdomain (dallas, honolulu), not a state name like Hawaii. Only listings with phone or email are imported."}
              {source === "craigslist" &&
                target === "business" &&
                "Uses your rented Craigslist actor on services listings. Use a city subdomain (e.g. dallas, honolulu), not a state name. Only listings with phone or email that match the selected service are imported (painters/hotels/churches filtered out)."}
            </p>

            <button
              type="submit"
              disabled={starting}
              style={{
                background: "#2563eb",
                border: "none",
                color: "white",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: starting ? "wait" : "pointer",
                opacity: starting ? 0.7 : 1,
                width: isNarrow ? "100%" : undefined,
              }}
            >
              {starting ? "Starting..." : "Run Scrape"}
            </button>
          </form>

          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: "12px",
                padding: "14px 16px",
                color: "#ef4444",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          {run && (
            <div
              style={{
                background: "#111827",
                border: "1px solid #1f2937",
                borderRadius: "16px",
                padding: isNarrow ? "16px" : "24px",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <h3 style={{ color: "white", fontWeight: "600", fontSize: "14px", margin: 0 }}>Scrape Run</h3>
                <span
                  style={{
                    background: statusColor + "22",
                    color: statusColor,
                    fontSize: "11px",
                    fontWeight: "700",
                    padding: "4px 12px",
                    borderRadius: "6px",
                  }}
                >
                  {run.status}
                </span>
              </div>

              <p style={{ color: "#6b7280", fontSize: "12px", margin: "0 0 4px", wordBreak: "break-word" }}>
                Type: <span style={{ color: "#e5e7eb" }}>{run.target || target}</span>
                {" · "}
                Source: <span style={{ color: "#e5e7eb" }}>{run.source || source}</span>
              </p>
              <p style={{ color: "#6b7280", fontSize: "12px", margin: "0 0 4px", wordBreak: "break-all" }}>
                Run ID: <span style={{ color: "#9ca3af" }}>{run.runId}</span>
              </p>

              {run.status === "RUNNING" || run.status === "READY" ? (
                <p style={{ color: "#fbbf24", fontSize: "12px", margin: "12px 0 0" }}>
                  Scraping in progress — this page checks status every 5 seconds...
                </p>
              ) : run.status === "SUCCEEDED" ? (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  style={{
                    marginTop: "16px",
                    background: "#10b981",
                    border: "none",
                    color: "white",
                    borderRadius: "8px",
                    padding: "10px 20px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: importing ? "wait" : "pointer",
                    opacity: importing ? 0.7 : 1,
                    width: isNarrow ? "100%" : undefined,
                  }}
                >
                  {importing ? "Importing..." : "Import Results as Leads"}
                </button>
              ) : (
                <p style={{ color: "#ef4444", fontSize: "12px", margin: "12px 0 0" }}>
                  Run did not complete successfully. Check your Apify console for details.
                </p>
              )}

              {importResult && (
                <div
                  style={{
                    marginTop: "16px",
                    background:
                      importResult.imported > 0
                        ? "rgba(52,211,153,0.08)"
                        : "rgba(251,191,36,0.08)",
                    border:
                      importResult.imported > 0
                        ? "1px solid rgba(52,211,153,0.25)"
                        : "1px solid rgba(251,191,36,0.3)",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <p
                    style={{
                      color: importResult.imported > 0 ? "#34d399" : "#fbbf24",
                      fontSize: "13px",
                      fontWeight: "600",
                      margin: "0 0 4px",
                    }}
                  >
                    {importResult.message ||
                      `Imported ${importResult.imported} new lead${importResult.imported === 1 ? "" : "s"}`}
                  </p>
                  <p style={{ color: "#6b7280", fontSize: "12px", margin: "0 0 12px" }}>
                    {importResult.scraped} scraped
                    {(importResult.skippedDuplicates ?? importResult.skipped)
                      ? `, ${importResult.skippedDuplicates ?? importResult.skipped} skipped as duplicates (same phone/email/URL)`
                      : ", 0 duplicates skipped"}
                    {importResult.skippedJunk
                      ? `, ${importResult.skippedJunk} junk skipped`
                      : ""}
                    {importResult.skippedNoContact
                      ? `, ${importResult.skippedNoContact} skipped (no email or phone)`
                      : ""}
                    {importResult.skippedIrrelevant
                      ? `, ${importResult.skippedIrrelevant} off-topic skipped`
                      : ""}
                  </p>
                  {importResult.imported > 0 && (
                    <a
                      href={`/dashboard/leads?batch=${encodeURIComponent(importResult.batchId || run.runId)}`}
                      style={{
                        background: "#2563eb",
                        color: "white",
                        borderRadius: "8px",
                        padding: "8px 16px",
                        fontSize: "12px",
                        fontWeight: "600",
                        textDecoration: "none",
                        display: isNarrow ? "block" : "inline-block",
                        textAlign: "center",
                      }}
                    >
                      View Leads
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
