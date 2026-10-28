"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "All leads", href: "/dashboard/leads" },
  { label: "Dialer", href: "/dashboard/leads/dialer" },
];

/** Subtabs shown under the Leads header. */
export default function LeadsTabs() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", gap: "4px", padding: "0 24px", background: "#111827", borderBottom: "1px solid #1f2937", flexShrink: 0 }}>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            style={{
              padding: "10px 12px",
              fontSize: "13px",
              fontWeight: active ? 600 : 500,
              color: active ? "white" : "#9ca3af",
              textDecoration: "none",
              borderBottom: `2px solid ${active ? "#2563eb" : "transparent"}`,
              marginBottom: "-1px",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
