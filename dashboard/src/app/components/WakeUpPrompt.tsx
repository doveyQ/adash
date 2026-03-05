"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sun } from "lucide-react";

export default function WakeUpPrompt() {
  const [wakeUpTime, setWakeUpTime] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState("07:00");
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const data = await r.json();
      if (data.wakeup_time) {
        setWakeUpTime(data.wakeup_time);
        const todayKey = `wakeup_date`;
        if (data[todayKey] !== new Date().toISOString().slice(0, 10)) {
          setShowModal(true);
          setInputValue(data.wakeup_time);
        }
      } else {
        setShowModal(true);
      }
    } catch {
      // Settings API not available yet
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "wakeup_time", value: inputValue }),
      });
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "wakeup_date",
          value: new Date().toISOString().slice(0, 10),
        }),
      });
      setWakeUpTime(inputValue);
      setShowModal(false);
    } catch {
      // retry silently
    } finally {
      setSaving(false);
    }
  };

  const hoursAwake = wakeUpTime
    ? (() => {
      const [h, m] = wakeUpTime.split(":").map(Number);
      const now = new Date();
      const wakeMinutes = h * 60 + m;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const diffMin = nowMinutes - wakeMinutes;
      return diffMin > 0 ? Math.round(diffMin / 60 * 10) / 10 : 0;
    })()
    : null;

  const modalContent = (
    <AnimatePresence>
      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(4px)",
          }}
          onClick={(e: React.MouseEvent) => {
            if (e.target === e.currentTarget && wakeUpTime) setShowModal(false);
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            style={{
              width: 340,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.1)",
              padding: 24,
              backgroundColor: "#13131f",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "rgba(251, 191, 36, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sun style={{ width: 20, height: 20, color: "#fbbf24" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: 0 }}>
                  Good morning
                </h3>
                <p style={{ fontSize: 12, color: "#a1a1aa", margin: 0 }}>
                  When did you wake up today?
                </p>
              </div>
            </div>

            <div style={{ paddingTop: 16, marginBottom: 20 }}>
              <input
                type="time"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  backgroundColor: "#18181b",
                  padding: "12px 16px",
                  fontSize: 18,
                  fontFamily: "monospace",
                  textAlign: "center",
                  color: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              onClick={save}
              disabled={saving}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "10px 16px",
                borderRadius: 12,
                backgroundColor: "#f59e0b",
                color: "#000",
                fontSize: 14,
                fontWeight: 700,
                border: "none",
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? (
                <span>Saving…</span>
              ) : (
                <>
                  <Check style={{ width: 16, height: 16 }} />
                  Confirm
                </>
              )}
            </button>

            {wakeUpTime && (
              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: "100%",
                  marginTop: 8,
                  padding: "8px 16px",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "#71717a",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        onClick={() => {
          setInputValue(wakeUpTime || "07:00");
          setShowModal(true);
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
          text-muted-foreground hover:text-foreground hover:bg-white/[0.04]
          transition-all cursor-pointer border border-white/[0.06]"
        title="Set wake-up time"
      >
        <Sun className="w-3.5 h-3.5 text-amber-400" />
        {wakeUpTime ? (
          <span>
            Woke at <span className="font-medium text-foreground">{wakeUpTime}</span>
            {hoursAwake !== null && (
              <span className="text-muted-foreground/60 ml-1">
                ({hoursAwake}h ago)
              </span>
            )}
          </span>
        ) : (
          <span>Set wake time</span>
        )}
      </button>

      {mounted && createPortal(modalContent, document.body)}
    </>
  );
}