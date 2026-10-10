"use client";

import { useState } from "react";
import { CalendarClock, Copy, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toaster";
import { absoluteUrl, formatDate } from "@/lib/utils";
import type { RoomState } from "@/types";

export function RoomHeader({ state }: { state: RoomState }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copyInvite() {
    const url = absoluteUrl(`/room/${state.room.token}`);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Invite link copied", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed — select the link manually", "error");
    }
  }

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-stone-900">
            {state.room.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <Badge variant="secondary">
              <CalendarClock className="h-3 w-3" />
              Expires {formatDate(state.room.expires)}
            </Badge>
            <Badge variant="secondary">
              {state.totalParticipants}{" "}
              {state.totalParticipants === 1
                ? "participant"
                : "participants"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copyInvite}>
            <Copy className="h-4 w-4" />
            {copied ? "Copied" : "Copy invite link"}
          </Button>
        </div>
      </div>
      <div className="border-t border-stone-100 bg-stone-50">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-1.5 text-xs text-stone-500">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Exact locations are private — everyone only sees
            travel estimates, never each other&apos;s address.
          </span>
        </div>
      </div>
    </header>
  );
}
