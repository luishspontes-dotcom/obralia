"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "agora";
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let active = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (active) setItems((data ?? []) as Notif[]);
    }

    load();

    // Realtime subscribe
    const ch = supabase
      .channel("notifications-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (open && popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markAllRead() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null)
      .eq("recipient_id", user.id);
    setItems((arr) => arr.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div ref={popRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open && unread > 0) markAllRead(); }}
        aria-label="Notificações"
        title="Notificações"
        style={{
          width: 44, height: 44, borderRadius: 10,
          display: "grid", placeItems: "center",
          background: "transparent", border: 0, color: "var(--o-text-2-on-dark, #b8b6b0)",
          cursor: "pointer", position: "relative",
          fontSize: 20,
        }}
      >
        🔔
        {unread > 0 && (
          <span
            className="tnum"
            style={{
              position: "absolute", top: 4, right: 4,
              minWidth: 18, height: 18, padding: "0 5px",
              background: "#e64646", color: "white",
              borderRadius: 999, fontSize: 10, fontWeight: 700,
              display: "grid", placeItems: "center",
              border: "2px solid var(--o-dark, #141c2a)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "fixed", top: 60, left: 90,
            width: 360, maxHeight: 480, overflow: "auto",
            background: "white", border: "1px solid var(--o-border)",
            borderRadius: 12, boxShadow: "0 12px 32px rgba(20,28,42,0.18)",
            zIndex: 100, color: "var(--o-text-1)",
          }}
        >
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid var(--o-border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--o-text-1)" }}>Notificações</span>
            {items.length > 0 && unread === 0 && (
              <span style={{ fontSize: 11, color: "var(--o-text-3)" }}>tudo lido</span>
            )}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--o-text-3)", fontSize: 13 }}>
              Sem notificações ainda.
            </div>
          ) : (
            items.map((n) => {
              const Wrap = n.link ? Link : "div";
              const wrapProps = n.link ? { href: n.link, onClick: () => setOpen(false) } : {};
              return (
                <Wrap
                  key={n.id}
                  {...(wrapProps as any)}
                  style={{
                    display: "block", padding: "12px 16px",
                    borderBottom: "1px solid var(--o-mist)",
                    background: !n.read_at ? "var(--t-brand-mist)" : "transparent",
                    textDecoration: "none", color: "inherit",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--o-text-1)", marginBottom: 2 }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{ fontSize: 12, color: "var(--o-text-2)", lineHeight: 1.45 }}>{n.body}</div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--o-text-3)", marginTop: 4 }}>
                    {timeAgo(n.created_at)}
                  </div>
                </Wrap>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
