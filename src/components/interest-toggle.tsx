"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";

/** Marks a client as interested in an IPO (or clears it). */
export function InterestToggle({ ipoId, clientId, interested, disabled }: { ipoId: string; clientId: string; interested: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (interested) await api(`/api/ipo-interests?ipoId=${ipoId}&clientId=${clientId}`, "DELETE");
      else await api("/api/ipo-interests", "POST", { ipoId, clientId });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (disabled) {
    return interested ? <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><Star size={12} className="fill-amber-400 text-amber-500" /> Interested</span> : null;
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors " +
        (interested ? "bg-amber-50 text-amber-800 hover:bg-amber-100" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800")
      }
    >
      <Star size={12} className={interested ? "fill-amber-400 text-amber-500" : ""} />
      {interested ? "Interested" : "Mark interested"}
    </button>
  );
}
