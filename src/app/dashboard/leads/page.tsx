"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { LeadCallButton, LeadDialerDock } from "@/components/dialer/LeadDialer";

const PAGE_SIZE = 100;

function displayName(lead: any) {
  if (lead.leadType === "individual") {
    const person = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
    return person || lead.title || "Individual lead";
  }
  return lead.title || [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Business lead";
}

function initials(lead: any) {
  const name = displayName(lead);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function isValidImageUrl(url?: string | null) {
  return !!url && /^https?:\/\//i.test(url);
}

function extractPhone(text?: string | null) {
  if (!text) return "";
  const match = String(text).match(
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/,
  );
  return match?.[0]?.replace(/\s+/g, " ").trim() || "";
}

function extractEmail(text?: string | null) {
  if (!text) return "";
  const match = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] || "";
}

function contactPhone(lead: any) {
  return lead.phone || extractPhone(lead.notes) || "";
}

function contactEmail(lead: any) {
  return lead.email || extractEmail(lead.notes) || "";
}

function LeadAvatar({
  lead,
  onClick,
}: {
  lead: any;
  onClick: () => void;
}) {
  const isPerson = lead.leadType === "individual";
  const [broken, setBroken] = useState(false);
  const showImage = isValidImageUrl(lead.imageUrl) && !broken;

  return (
    <button
      onClick={onClick}
      style={{
        width: 56,
        height: 56,
        borderRadius: isPerson ? "50%" : "12px",
        border: "none",
        overflow: "hidden",
        padding: 0,
        cursor: "pointer",
        background: isPerson ? "#4c1d95" : "#1e3a8a",
        color: "white",
        fontWeight: 700,
        fontSize: 15,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={lead.imageUrl}
          alt=""
          onError={() => setBroken(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials(lead)
      )}
    </button>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  google: "Google",
  people: "People Finder",
  craigslist: "Craigslist",
  facebook: "Facebook",
  csv_import: "CSV Import",
  manual: "Manual",
};

type ImportBatch = {
  batchId: string;
  count: number;
  importedAt: string | null;
  source: string | null;
  serviceCategory: string | null;
  leadType: string | null;
};

function batchDate(batch: ImportBatch) {
  if (!batch.importedAt) return "";
  const d = new Date(batch.importedAt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function batchLabel(batch: ImportBatch) {
  const parts = [
    batchDate(batch) || "Unknown date",
    batch.serviceCategory,
    batch.source ? SOURCE_LABELS[batch.source] || batch.source : null,
    `${batch.count} lead${batch.count === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

const selectStyle = {
  background: "#1f2937",
  border: "1px solid #374151",
  color: "white",
  borderRadius: "8px",
  padding: "8px 14px",
  fontSize: "13px",
  outline: "none",
} as const;

function LeadsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL is the single source of truth for filters — browser back restores them
  const typeFilter = searchParams.get("tab") || "";
  const statusFilter = searchParams.get("status") || "";
  const sourceFilter = searchParams.get("source") || "";
  const batchFilter = searchParams.get("batch") || "";
  const categoryFilter = searchParams.get("category") || "";
  const hasContact = searchParams.get("hasContact") === "1";
  const newToday = searchParams.get("newToday") === "1";
  const urlSearch = searchParams.get("search") || "";
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);

  const [leads, setLeads] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, individuals: 0, businesses: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [searchInput, setSearchInput] = useState(urlSearch);
  const [isNarrow, setIsNarrow] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const setParams = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (resetPage) params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params: any = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (typeFilter) params.leadType = typeFilter;
      if (batchFilter) params.batch = batchFilter;
      if (categoryFilter) params.serviceCategory = categoryFilter;
      if (hasContact) params.hasContact = "1";
      if (newToday) params.newToday = "1";
      if (urlSearch) params.search = urlSearch;
      const res = await api.get("/leads", { params });
      const payload = res.data;
      if (Array.isArray(payload)) {
        // Older backend shape — plain array
        setLeads(payload);
        setTotal(payload.length);
        const individuals = payload.filter((l) => l.leadType === "individual").length;
        setCounts({ all: payload.length, individuals, businesses: payload.length - individuals });
      } else {
        setLeads(payload.data || []);
        setTotal(payload.total ?? (payload.data || []).length);
        setCounts(payload.counts || { all: 0, individuals: 0, businesses: 0 });
      }
    } catch (err: unknown) {
      console.error(err);
      setLeads([]);
      setTotal(0);
      setError(getErrorMessage(err, "Failed to load leads. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, sourceFilter, typeFilter, batchFilter, categoryFilter, hasContact, newToday, urlSearch]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    api
      .get("/leads/categories")
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCategories([]));
    api
      .get("/leads/batches")
      .then((res) => setBatches(Array.isArray(res.data) ? res.data : []))
      .catch(() => setBatches([]));
  }, []);

  // Debounced search → URL
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      if (searchInput !== urlSearch) setParams({ search: searchInput || null });
    }, 400);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const categoryOptions =
    categoryFilter && !categories.includes(categoryFilter)
      ? [categoryFilter, ...categories]
      : categories;
  const selectedBatch = batchFilter
    ? batches.find((b) => b.batchId === batchFilter) || null
    : null;

  const statusColors: any = {
    new: { bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
    called: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
    interested: { bg: "rgba(52,211,153,0.15)", color: "#34d399" },
    not_interested: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
    no_answer: { bg: "rgba(156,163,175,0.15)", color: "#9ca3af" },
    callback: { bg: "rgba(168,85,247,0.15)", color: "#a855f7" },
    closed_won: { bg: "rgba(52,211,153,0.2)", color: "#10b981" },
    disqualified: { bg: "rgba(239,68,68,0.1)", color: "#6b7280" },
  };

  async function updateStatus(id: string, status: string) {
    try {
      await api.patch("/leads/" + id + "/status", { status });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    } catch (e) {
      console.error(e);
    }
  }

  function currentFilterParams() {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (sourceFilter) params.source = sourceFilter;
    if (typeFilter) params.leadType = typeFilter;
    if (batchFilter) params.batch = batchFilter;
    if (categoryFilter) params.serviceCategory = categoryFilter;
    if (hasContact) params.hasContact = "1";
    if (newToday) params.newToday = "1";
    if (urlSearch) params.search = urlSearch;
    return params;
  }

  async function handleExport() {
    try {
      setExporting(true);
      setExportError("");
      const res = await api.get("/leads/export", {
        params: currentFilterParams(),
        responseType: "blob",
        timeout: 120000,
      });

      const contentType = String(res.headers["content-type"] || "");
      if (contentType.includes("application/json")) {
        const text = await (res.data as Blob).text();
        let message = "Export failed";
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed?.message === "string") message = parsed.message;
          else if (Array.isArray(parsed?.message)) message = parsed.message.join(", ");
        } catch {
          /* keep fallback */
        }
        setExportError(message);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `greymoon-leads-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error(err);
      // Axios blob errors often return JSON as a Blob
      if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: Blob } }).response?.data instanceof Blob
      ) {
        try {
          const text = await (err as { response: { data: Blob } }).response.data.text();
          const parsed = JSON.parse(text);
          const message = parsed?.message;
          if (typeof message === "string") {
            setExportError(message);
            return;
          }
          if (Array.isArray(message)) {
            setExportError(message.filter((m) => typeof m === "string").join(", ") || "Export failed");
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setExportError(getErrorMessage(err, "Export failed. Check your connection and try again."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <header
        style={{
          background: "#111827",
          borderBottom: "1px solid #1f2937",
          padding: isNarrow ? "14px 16px" : "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <h2 style={{ color: "white", fontWeight: "600", fontSize: "15px", margin: 0 }}>Leads</h2>
          <p style={{ color: "#6b7280", fontSize: "11px", margin: "2px 0 0" }}>
            {counts.all} leads · {counts.individuals} individuals · {counts.businesses} businesses
          </p>
          {exportError && (
            <p style={{ color: "#f87171", fontSize: "11px", margin: "6px 0 0", maxWidth: 480 }}>
              {exportError}
            </p>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            style={{
              background: "#1f2937",
              color: exporting || loading ? "#6b7280" : "white",
              border: "1px solid #374151",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: exporting || loading ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <button
            onClick={() => router.push("/dashboard/leads/import")}
            style={{
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Import CSV
          </button>
        </div>
      </header>

      {batchFilter && (
        <div
          style={{
            background: "rgba(52,211,153,0.08)",
            borderBottom: "1px solid rgba(52,211,153,0.25)",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <p style={{ color: "#34d399", fontSize: "12px", fontWeight: 600, margin: 0 }}>
            Showing {loading ? "..." : total} lead{total === 1 ? "" : "s"} from import
            <span style={{ color: "#6b7280", fontWeight: 400 }}>
              {" · "}
              {selectedBatch
                ? [
                    batchDate(selectedBatch),
                    selectedBatch.serviceCategory,
                    selectedBatch.source
                      ? SOURCE_LABELS[selectedBatch.source] || selectedBatch.source
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : `batch ${batchFilter}`}
            </span>
          </p>
          <button
            onClick={() => setParams({ batch: null })}
            style={{
              background: "transparent",
              border: "1px solid rgba(52,211,153,0.4)",
              color: "#34d399",
              borderRadius: "6px",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Clear filter — show all leads
          </button>
        </div>
      )}

      {newToday && (
        <div
          style={{
            background: "rgba(96,165,250,0.08)",
            borderBottom: "1px solid rgba(96,165,250,0.25)",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <p style={{ color: "#60a5fa", fontSize: "12px", fontWeight: 600, margin: 0 }}>
            Showing {loading ? "..." : total} lead{total === 1 ? "" : "s"} added today
          </p>
          <button
            onClick={() => setParams({ newToday: null })}
            style={{
              background: "transparent",
              border: "1px solid rgba(96,165,250,0.4)",
              color: "#60a5fa",
              borderRadius: "6px",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Clear filter
          </button>
        </div>
      )}

      <div
        style={{
          padding: isNarrow ? "12px 16px" : "16px 24px",
          background: "#0f172a",
          borderBottom: "1px solid #1f2937",
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", gap: "6px" }}>
          {[
            { key: "", label: `All (${counts.all})` },
            { key: "individual", label: `Individuals (${counts.individuals})` },
            { key: "business", label: `Businesses (${counts.businesses})` },
          ].map((tab) => (
            <button
              key={tab.key || "all"}
              onClick={() => setParams({ tab: tab.key || null })}
              style={{
                background: typeFilter === tab.key ? "#2563eb" : "#1f2937",
                border: `1px solid ${typeFilter === tab.key ? "#2563eb" : "#374151"}`,
                color: typeFilter === tab.key ? "white" : "#9ca3af",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, phone, or email..."
          style={{
            flex: 1,
            minWidth: "180px",
            background: "#1f2937",
            border: "1px solid #374151",
            color: "white",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "13px",
            outline: "none",
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setParams({ status: e.target.value || null })}
          style={selectStyle}
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="called">Called</option>
          <option value="interested">Interested</option>
          <option value="not_interested">Not Interested</option>
          <option value="no_answer">No Answer</option>
          <option value="callback">Callback</option>
          <option value="closed_won">Closed Won</option>
          <option value="disqualified">Disqualified</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setParams({ source: e.target.value || null })}
          style={selectStyle}
        >
          <option value="">All Sources</option>
          <option value="google">Google</option>
          <option value="people">People Finder</option>
          <option value="craigslist">Craigslist</option>
          <option value="facebook">Facebook</option>
          <option value="csv_import">CSV Import</option>
          <option value="manual">Manual</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setParams({ category: e.target.value || null })}
          style={{ ...selectStyle, maxWidth: "200px" }}
        >
          <option value="">All Categories</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={batchFilter}
          onChange={(e) => setParams({ batch: e.target.value || null })}
          title="Filter by scrape / import batch"
          style={{ ...selectStyle, maxWidth: "260px" }}
        >
          <option value="">All Imports</option>
          {batchFilter && !batches.some((b) => b.batchId === batchFilter) && (
            <option value={batchFilter}>Batch {batchFilter}</option>
          )}
          {batches.map((b) => (
            <option key={b.batchId} value={b.batchId}>
              {batchLabel(b)}
            </option>
          ))}
        </select>
        <button
          onClick={() => setParams({ hasContact: hasContact ? null : "1" })}
          title="Only show leads with a phone number or email"
          style={{
            background: hasContact ? "#2563eb" : "#1f2937",
            border: `1px solid ${hasContact ? "#2563eb" : "#374151"}`,
            color: hasContact ? "white" : "#9ca3af",
            borderRadius: "8px",
            padding: "8px 12px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {hasContact ? "✓ " : ""}Has contact
        </button>
        <button
          onClick={fetchLeads}
          style={{
            background: "#1f2937",
            border: "1px solid #374151",
            color: "#9ca3af",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      {/* On wide screens the dialer sits beside the list; on smaller ones Call opens it as a drawer. */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      <main style={{ flex: 1, overflow: "auto", padding: isNarrow ? "16px" : "24px", minWidth: 0 }}>
        {error ? (
          <div
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "14px",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#ef4444", fontSize: "14px", fontWeight: 600, margin: "0 0 6px" }}>
              Could not load leads
            </p>
            <p style={{ color: "#9ca3af", fontSize: "12px", margin: "0 0 16px" }}>{error}</p>
            <button
              onClick={fetchLeads}
              style={{
                background: "#2563eb",
                border: "none",
                color: "white",
                borderRadius: "8px",
                padding: "8px 20px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>Loading leads...</div>
        ) : leads.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <p style={{ color: "#4b5563", fontSize: "14px", margin: "0 0 6px" }}>No leads found</p>
            <p style={{ color: "#374151", fontSize: "12px", margin: 0 }}>
              {batchFilter || categoryFilter || statusFilter || sourceFilter || urlSearch || hasContact || newToday
                ? "Try clearing some filters"
                : "Run Individual or Business scrape, then import results"}
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {leads.map((lead) => {
                const isPerson = lead.leadType === "individual";
                const phone = contactPhone(lead);
                const email = contactEmail(lead);
                const showCraigslistReply =
                  lead.source === "craigslist" && !phone && !email && isValidImageUrl(lead.sourceUrl);
                return (
                  <div
                    key={lead.id}
                    style={{
                      background: "#111827",
                      border: `1px solid ${isPerson ? "rgba(168,85,247,0.35)" : "rgba(96,165,250,0.28)"}`,
                      borderRadius: "14px",
                      padding: isNarrow ? "12px" : "14px 16px",
                      display: "grid",
                      gridTemplateColumns: isNarrow
                        ? "56px minmax(0, 1fr)"
                        : "56px minmax(0, 1.5fr) minmax(160px, 1fr) auto",
                      gap: isNarrow ? "12px" : "16px",
                      alignItems: isNarrow ? "start" : "center",
                      minWidth: 0,
                    }}
                  >
                    <LeadAvatar
                      lead={lead}
                      onClick={() => router.push("/dashboard/leads/" + lead.id)}
                    />

                    <div
                      style={{ cursor: "pointer", minWidth: 0, gridColumn: isNarrow ? "2" : undefined }}
                      onClick={() => router.push("/dashboard/leads/" + lead.id)}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                        <span
                          style={{
                            background: isPerson ? "rgba(168,85,247,0.18)" : "rgba(96,165,250,0.18)",
                            color: isPerson ? "#c084fc" : "#60a5fa",
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: 999,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {isPerson ? "INDIVIDUAL" : "BUSINESS"}
                        </span>
                        <span style={{ color: "#6b7280", fontSize: 10, textTransform: "uppercase" }}>
                          {lead.source}
                        </span>
                        {lead.serviceCategory && (
                          <span
                            style={{
                              background: "rgba(251,191,36,0.12)",
                              color: "#fbbf24",
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "3px 8px",
                              borderRadius: 999,
                            }}
                          >
                            {lead.serviceCategory}
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          color: "white",
                          fontSize: 14,
                          fontWeight: 700,
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {displayName(lead)}
                      </p>
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "4px 0 0" }}>
                        Click to view about details
                      </p>
                    </div>

                    <div
                      style={{
                        gridColumn: isNarrow ? "1 / -1" : undefined,
                        minWidth: 0,
                      }}
                    >
                      <p style={{ color: "#6b7280", fontSize: 11, margin: "0 0 4px" }}>Contact</p>
                      <p
                        style={{
                          color: phone ? "#34d399" : "#4b5563",
                          fontSize: 13,
                          margin: 0,
                          fontWeight: 600,
                          wordBreak: "break-word",
                        }}
                      >
                        {phone || "No phone"}
                      </p>
                      <p
                        style={{
                          color: email ? "#60a5fa" : "#4b5563",
                          fontSize: 12,
                          margin: "4px 0 0",
                          wordBreak: "break-word",
                        }}
                      >
                        {email || "No email"}
                      </p>
                      {showCraigslistReply && (
                        <a
                          href={lead.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: "inline-block",
                            marginTop: 6,
                            background: "rgba(96,165,250,0.12)",
                            border: "1px solid rgba(96,165,250,0.35)",
                            color: "#60a5fa",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          Reply on Craigslist ↗
                        </a>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: isNarrow ? "row" : "column",
                        gap: 8,
                        alignItems: isNarrow ? "center" : "flex-end",
                        justifyContent: isNarrow ? "space-between" : undefined,
                        gridColumn: isNarrow ? "1 / -1" : undefined,
                      }}
                    >
                      <span
                        style={{
                          background: statusColors[lead.status]?.bg || "#1f2937",
                          color: statusColors[lead.status]?.color || "#9ca3af",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6,
                        }}
                      >
                        {lead.status?.replace("_", " ")}
                      </span>
                      <select
                        value={lead.status}
                        onChange={(e) => updateStatus(lead.id, e.target.value)}
                        style={{
                          background: "#1f2937",
                          border: "1px solid #374151",
                          color: "white",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 11,
                          outline: "none",
                          cursor: "pointer",
                          maxWidth: "100%",
                        }}
                      >
                        <option value="new">New</option>
                        <option value="called">Called</option>
                        <option value="interested">Interested</option>
                        <option value="not_interested">Not Interested</option>
                        <option value="no_answer">No Answer</option>
                        <option value="callback">Callback</option>
                        <option value="closed_won">Closed Won</option>
                        <option value="disqualified">Disqualified</option>
                      </select>
                      <LeadCallButton
                        lead={lead}
                        onSaved={(status) =>
                          setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status } : l)))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {total > PAGE_SIZE && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "16px",
                  marginTop: "20px",
                }}
              >
                <button
                  disabled={page <= 1}
                  onClick={() => setParams({ page: String(page - 1) }, false)}
                  style={{
                    background: "#1f2937",
                    border: "1px solid #374151",
                    color: page <= 1 ? "#4b5563" : "#e5e7eb",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: page <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  ← Previous
                </button>
                <span style={{ color: "#9ca3af", fontSize: "12px" }}>
                  Page {page} of {totalPages} · {total} leads
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setParams({ page: String(page + 1) }, false)}
                  style={{
                    background: "#1f2937",
                    border: "1px solid #374151",
                    color: page >= totalPages ? "#4b5563" : "#e5e7eb",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: page >= totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <LeadDialerDock style={{ width: 360, flexShrink: 0 }} />
      </div>
    </>
  );
}

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>Loading leads...</div>
      }
    >
      <LeadsPageInner />
    </Suspense>
  );
}
