"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUser, logout, type User } from "@/lib/auth";
import Logo from "@/components/Logo";

const BASE_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Leads", href: "/dashboard/leads" },
  { label: "Heat Map", href: "/dashboard/map" },
  { label: "Scraper", href: "/dashboard/scrape" },
];

const ADMIN_LINKS = [
  { label: "Agents", href: "/dashboard/agents" },
  { label: "Analytics", href: "/dashboard/analytics" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => {
      setIsNarrow(mq.matches);
      if (!mq.matches) setOpen(false);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Close drawer on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const links = isAdmin ? [...BASE_LINKS, ...ADMIN_LINKS] : BASE_LINKS;

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const nav = (
    <>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #1f2937" }}>
        <Logo size={36} showText subtitle="Sales Lead Platform" />
      </div>

      <nav style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: "8px",
              color: isActive(item.href) ? "#fff" : "#9ca3af",
              textDecoration: "none",
              fontSize: "13px",
              marginBottom: "2px",
              background: isActive(item.href) ? "#1f2937" : "transparent",
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ padding: "16px", borderTop: "1px solid #1f2937" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#1f2937", borderRadius: "10px", marginBottom: "8px" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "11px", fontWeight: "bold", flexShrink: 0 }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "white", fontSize: "12px", fontWeight: "600", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.firstName} {user?.lastName}
            </p>
            <p style={{ color: "#6b7280", fontSize: "11px", margin: 0, textTransform: "capitalize" }}>{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          style={{ width: "100%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", borderRadius: "8px", padding: "9px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>
    </>
  );

  if (isNarrow) {
    return (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "10px 14px",
            background: "#111827",
            borderBottom: "1px solid #1f2937",
            flexShrink: 0,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <Logo size={28} showText subtitle="Sales Lead Platform" />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{
              background: "#1f2937",
              border: "1px solid #374151",
              color: "white",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>

        {open && (
          <>
            <div
              onClick={() => setOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                zIndex: 40,
              }}
            />
            <aside
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                width: "min(280px, 86vw)",
                background: "#111827",
                borderRight: "1px solid #1f2937",
                display: "flex",
                flexDirection: "column",
                zIndex: 50,
                boxShadow: "8px 0 24px rgba(0,0,0,0.35)",
              }}
            >
              {nav}
            </aside>
          </>
        )}
      </>
    );
  }

  return (
    <aside style={{ width: "240px", background: "#111827", borderRight: "1px solid #1f2937", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {nav}
    </aside>
  );
}
