"use client";
import Dialer from "@/components/dialer/Dialer";

export default function DialerPage() {
  return (
    <>
      <header style={{ background: "#111827", borderBottom: "1px solid #1f2937", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <h2 style={{ color: "white", fontWeight: "600", fontSize: "15px", margin: 0 }}>Dialer</h2>
          <p style={{ color: "#6b7280", fontSize: "11px", margin: "2px 0 0" }}>
            Dial any number. To set an outcome on a lead, use the Call button on the lead instead.
          </p>
        </div>
      </header>

      <main style={{ flex: 1, overflow: "auto", padding: "24px" }}>
        <Dialer />
      </main>
    </>
  );
}
