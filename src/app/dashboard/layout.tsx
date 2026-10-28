"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import { LeadDialerProvider } from "@/components/dialer/LeadDialer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <LeadDialerProvider>
    <div
      style={{
        background: "#030712",
        height: "100vh",
        display: "flex",
        flexDirection: isNarrow ? "column" : "row",
        overflow: "hidden",
        width: "100%",
        maxWidth: "100vw",
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </div>
    </LeadDialerProvider>
  );
}
