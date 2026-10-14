"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

// No 0/O/1/l/I so the password can be read out over the phone without mistakes
const TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateTempPassword(length = 10) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => TEMP_PASSWORD_CHARS[v % TEMP_PASSWORD_CHARS.length]).join("");
}

export default function AgentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [resetValue, setResetValue] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    const u = getUser();
    if (u && u.role !== "admin" && u.role !== "super_admin") {
      router.push("/dashboard");
      return;
    }
    setUser(u);
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      setLoading(true);
      const res = await api.get("/users");
      setAgents(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    setError("");
    try {
      await api.patch("/users/" + id + "/status", { status });
      await fetchAgents();
    } catch (e) {
      setError(getErrorMessage(e, "Failed to update status"));
    } finally {
      setUpdating(null);
    }
  }

  async function updateRole(id: string, role: string) {
    setUpdating(id);
    setError("");
    try {
      await api.patch("/users/" + id + "/role", { role });
      await fetchAgents();
    } catch (e) {
      setError(getErrorMessage(e, "Failed to update role"));
    } finally {
      setUpdating(null);
    }
  }

  function openReset(agent: any) {
    setResetTarget(agent);
    setResetValue(generateTempPassword());
    setResetDone(false);
    setResetError("");
    setCopied(false);
  }

  function closeReset() {
    setResetTarget(null);
    setResetValue("");
    setResetDone(false);
    setResetError("");
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (resetValue.length < 8) {
      setResetError("Password must be at least 8 characters");
      return;
    }
    setResetting(true);
    setResetError("");
    try {
      await api.patch("/users/" + resetTarget.id + "/password", { password: resetValue });
      setResetDone(true);
    } catch (e) {
      setResetError(getErrorMessage(e, "Failed to reset password"));
    } finally {
      setResetting(false);
    }
  }

  async function copyResetPassword() {
    try {
      await navigator.clipboard.writeText(resetValue);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function approveAs(id: string, role: "agent" | "admin") {
    setUpdating(id);
    setError("");
    try {
      await api.patch("/users/" + id + "/status", { status: "active" });
      if (isSuperAdmin && role !== "agent") {
        await api.patch("/users/" + id + "/role", { role });
      } else if (isSuperAdmin && role === "agent") {
        // Ensure demotion path if they somehow had another role while pending
        const target = agents.find((a) => a.id === id);
        if (target && target.role !== "agent" && target.role !== "super_admin") {
          await api.patch("/users/" + id + "/role", { role: "agent" });
        }
      }
      await fetchAgents();
    } catch (e) {
      setError(getErrorMessage(e, "Failed to approve user"));
    } finally {
      setUpdating(null);
    }
  }

  const statusColors: any = {
    active: { bg: "rgba(52,211,153,0.15)", color: "#34d399", label: "Active" },
    pending: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24", label: "Pending" },
    suspended: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", label: "Suspended" },
  };

  const roleColors: any = {
    admin: { bg: "rgba(96,165,250,0.15)", color: "#60a5fa" },
    super_admin: { bg: "rgba(167,139,250,0.15)", color: "#a78bfa" },
    agent: { bg: "rgba(156,163,175,0.15)", color: "#9ca3af" },
  };

  const filtered = agents.filter((a) => {
    const matchesFilter = filter === "all" || a.status === filter;
    const matchesSearch =
      search === "" ||
      a.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      a.lastName?.toLowerCase().includes(search.toLowerCase()) ||
      a.email?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const counts = {
    all: agents.length,
    active: agents.filter((a) => a.status === "active").length,
    pending: agents.filter((a) => a.status === "pending").length,
    suspended: agents.filter((a) => a.status === "suspended").length,
  };

  const roleSelectStyle = {
    background: "#1f2937",
    border: "1px solid #374151",
    color: "#e5e7eb",
    borderRadius: "6px",
    padding: "5px 8px",
    fontSize: "11px",
    cursor: "pointer",
  } as const;

  return (
    <>
      <header
        style={{
          background: "#111827",
          borderBottom: "1px solid #1f2937",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ color: "white", fontWeight: "600", fontSize: "15px", margin: 0 }}>
            Agent Management
          </h2>
          <p style={{ color: "#6b7280", fontSize: "11px", margin: "2px 0 0" }}>
            {agents.length} total users registered
            {isSuperAdmin ? " · You can assign Admin role" : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {counts.pending > 0 && (
            <div
              style={{
                background: "rgba(251,191,36,0.15)",
                border: "1px solid rgba(251,191,36,0.3)",
                color: "#fbbf24",
                borderRadius: "8px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              {counts.pending} pending approval
            </div>
          )}
          <button
            onClick={fetchAgents}
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
      </header>

      <div
        style={{
          padding: "16px 24px",
          background: "#0f172a",
          borderBottom: "1px solid #1f2937",
          display: "flex",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          style={{
            flex: 1,
            minWidth: "200px",
            background: "#1f2937",
            border: "1px solid #374151",
            color: "white",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "13px",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: "6px" }}>
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "active", label: "Active" },
            { key: "suspended", label: "Suspended" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? "#2563eb" : "#1f2937",
                border: "1px solid " + (filter === f.key ? "#2563eb" : "#374151"),
                color: filter === f.key ? "white" : "#9ca3af",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: filter === f.key ? "600" : "400",
              }}
            >
              {f.label} ({counts[f.key as keyof typeof counts]})
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          style={{
            margin: "16px 24px 0",
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#fca5a5",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      <main style={{ flex: 1, overflow: "auto", padding: "24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>
            Loading agents...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px" }}>
            <p style={{ color: "#4b5563", fontSize: "14px", margin: "0 0 6px" }}>No agents found</p>
            <p style={{ color: "#374151", fontSize: "12px", margin: 0 }}>
              Agents will appear here once they register
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1f2937" }}>
                  {["Agent", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        color: "#6b7280",
                        fontSize: "11px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent, i) => (
                  <tr
                    key={agent.id}
                    style={{
                      borderBottom: i < filtered.length - 1 ? "1px solid #1f2937" : "none",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1f2937")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            background:
                              agent.role === "admin" || agent.role === "super_admin"
                                ? "#2563eb"
                                : "#374151",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: "bold",
                            flexShrink: 0,
                          }}
                        >
                          {agent.firstName?.[0]}
                          {agent.lastName?.[0]}
                        </div>
                        <div>
                          <p
                            style={{
                              color: "white",
                              fontSize: "13px",
                              fontWeight: "500",
                              margin: 0,
                            }}
                          >
                            {agent.firstName} {agent.lastName}
                          </p>
                          <p style={{ color: "#6b7280", fontSize: "11px", margin: "2px 0 0" }}>
                            {agent.phone || "No phone"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#60a5fa", fontSize: "13px" }}>
                      {agent.email}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {isSuperAdmin &&
                      agent.id !== user?.id &&
                      agent.role !== "super_admin" ? (
                        <select
                          value={agent.role === "admin" ? "admin" : "agent"}
                          disabled={updating === agent.id}
                          onChange={(e) => updateRole(agent.id, e.target.value)}
                          style={roleSelectStyle}
                          title="Change role"
                        >
                          <option value="agent">Agent</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            background: roleColors[agent.role]?.bg || "#1f2937",
                            color: roleColors[agent.role]?.color || "#9ca3af",
                            fontSize: "11px",
                            fontWeight: "600",
                            padding: "3px 10px",
                            borderRadius: "6px",
                            textTransform: "capitalize",
                          }}
                        >
                          {agent.role?.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          background: statusColors[agent.status]?.bg || "#1f2937",
                          color: statusColors[agent.status]?.color || "#9ca3af",
                          fontSize: "11px",
                          fontWeight: "600",
                          padding: "3px 10px",
                          borderRadius: "6px",
                        }}
                      >
                        {statusColors[agent.status]?.label || agent.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "#6b7280", fontSize: "12px" }}>
                      {new Date(agent.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {agent.status === "pending" && isSuperAdmin && (
                          <>
                            <button
                              onClick={() => approveAs(agent.id, "agent")}
                              disabled={updating === agent.id}
                              style={{
                                background: "rgba(52,211,153,0.15)",
                                border: "1px solid rgba(52,211,153,0.3)",
                                color: "#34d399",
                                borderRadius: "6px",
                                padding: "5px 12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              {updating === agent.id ? "..." : "Approve as Agent"}
                            </button>
                            <button
                              onClick={() => approveAs(agent.id, "admin")}
                              disabled={updating === agent.id}
                              style={{
                                background: "rgba(96,165,250,0.15)",
                                border: "1px solid rgba(96,165,250,0.3)",
                                color: "#60a5fa",
                                borderRadius: "6px",
                                padding: "5px 12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              {updating === agent.id ? "..." : "Approve as Admin"}
                            </button>
                          </>
                        )}
                        {agent.status === "pending" && !isSuperAdmin && (
                          <button
                            onClick={() => updateStatus(agent.id, "active")}
                            disabled={updating === agent.id}
                            style={{
                              background: "rgba(52,211,153,0.15)",
                              border: "1px solid rgba(52,211,153,0.3)",
                              color: "#34d399",
                              borderRadius: "6px",
                              padding: "5px 12px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            {updating === agent.id ? "..." : "Approve"}
                          </button>
                        )}
                        {agent.status === "active" && agent.id !== user?.id && (
                          <button
                            onClick={() => updateStatus(agent.id, "suspended")}
                            disabled={updating === agent.id}
                            style={{
                              background: "rgba(239,68,68,0.15)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              color: "#ef4444",
                              borderRadius: "6px",
                              padding: "5px 12px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            {updating === agent.id ? "..." : "Suspend"}
                          </button>
                        )}
                        {agent.status === "suspended" && (
                          <button
                            onClick={() => updateStatus(agent.id, "active")}
                            disabled={updating === agent.id}
                            style={{
                              background: "rgba(96,165,250,0.15)",
                              border: "1px solid rgba(96,165,250,0.3)",
                              color: "#60a5fa",
                              borderRadius: "6px",
                              padding: "5px 12px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            {updating === agent.id ? "..." : "Reactivate"}
                          </button>
                        )}
                        {isSuperAdmin &&
                          agent.id !== user?.id &&
                          agent.role !== "super_admin" && (
                            <button
                              onClick={() => openReset(agent)}
                              disabled={updating === agent.id}
                              style={{
                                background: "rgba(167,139,250,0.15)",
                                border: "1px solid rgba(167,139,250,0.3)",
                                color: "#a78bfa",
                                borderRadius: "6px",
                                padding: "5px 12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              Reset password
                            </button>
                          )}
                        {agent.id === user?.id && (
                          <span style={{ color: "#374151", fontSize: "11px", fontStyle: "italic" }}>
                            You
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {resetTarget && (
        <div
          onClick={closeReset}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "420px",
            }}
          >
            <h3 style={{ color: "white", fontSize: "15px", fontWeight: "600", margin: "0 0 4px" }}>
              Reset password
            </h3>
            <p style={{ color: "#9ca3af", fontSize: "12px", margin: "0 0 16px" }}>
              {resetTarget.firstName} {resetTarget.lastName} · {resetTarget.email}
            </p>

            {resetDone ? (
              <>
                <p style={{ color: "#34d399", fontSize: "13px", margin: "0 0 12px" }}>
                  Password reset. Send these login details to the user:
                </p>
                <div
                  style={{
                    background: "#0f172a",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "13px",
                    color: "#e5e7eb",
                    lineHeight: 1.6,
                  }}
                >
                  Email: {resetTarget.email}
                  <br />
                  Password: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{resetValue}</span>
                </div>
                <p style={{ color: "#6b7280", fontSize: "11px", margin: "10px 0 16px" }}>
                  This password is not shown again after you close this window.
                </p>
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    onClick={copyResetPassword}
                    style={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      color: "#e5e7eb",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {copied ? "Copied" : "Copy password"}
                  </button>
                  <button
                    onClick={closeReset}
                    style={{
                      background: "#2563eb",
                      border: "1px solid #2563eb",
                      color: "white",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
                <label style={{ color: "#9ca3af", fontSize: "11px", display: "block", marginBottom: "6px" }}>
                  New password (at least 8 characters)
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={resetValue}
                    onChange={(e) => setResetValue(e.target.value)}
                    style={{
                      flex: 1,
                      background: "#1f2937",
                      border: "1px solid #374151",
                      color: "white",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "13px",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={() => setResetValue(generateTempPassword())}
                    style={{
                      background: "#1f2937",
                      border: "1px solid #374151",
                      color: "#9ca3af",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Generate
                  </button>
                </div>
                {resetError && (
                  <p style={{ color: "#fca5a5", fontSize: "12px", margin: "10px 0 0" }}>{resetError}</p>
                )}
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "18px" }}>
                  <button
                    onClick={closeReset}
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
                    Cancel
                  </button>
                  <button
                    onClick={submitReset}
                    disabled={resetting}
                    style={{
                      background: "#7c3aed",
                      border: "1px solid #7c3aed",
                      color: "white",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    {resetting ? "Resetting..." : "Reset password"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
