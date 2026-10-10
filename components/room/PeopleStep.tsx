"use client";

import { useState } from "react";
import {
  BadgeCheck,
  Copy,
  Crown,
  LogOut,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toaster";
import { absoluteUrl } from "@/lib/utils";
import type { RoomState } from "@/types";

export function PeopleStep({
  state,
  onChanged,
}: {
  state: RoomState;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        absoluteUrl(`/room/${state.room.token}`),
      );
      setCopied(true);
      toast("Invite link copied", "success");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed — select the link manually", "error");
    }
  }

  async function leaveRoom() {
    setLeaving(true);
    try {
      const res = await fetch(`/api/rooms/${state.room.token}/leave`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Could not leave room");
      }
      toast("You left the room", "info");
      window.location.href = "/";
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not leave room",
        "error",
      );
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <h2 className="mb-4 text-base font-semibold text-stone-900">
          Who&apos;s in
        </h2>
        <ul className="flex flex-col divide-y divide-stone-100">
          {state.participants.map((participant) => (
            <li
              key={participant.id}
              className="flex items-center gap-3 py-3"
            >
              <Avatar name={participant.displayName} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-stone-900">
                    {participant.displayName}
                  </span>
                  {participant.isHost && (
                    <Badge variant="default">
                      <Crown className="h-3 w-3" /> Host
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {participant.hasLocation ? (
                    <Badge variant="success">
                      <MapPin className="h-3 w-3" /> Location
                      shared
                    </Badge>
                  ) : (
                    <Badge variant="outline">No location yet</Badge>
                  )}
                  {participant.hasPreferences ? (
                    <Badge variant="success">
                      <SlidersHorizontal className="h-3 w-3" />
                      Preferences set
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      Preferences pending
                    </Badge>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-stone-900">
            <BadgeCheck className="h-5 w-5 text-brand-600" />
            Invite friends
          </h2>
          <p className="mb-3 text-sm text-stone-600">
            Share this link — friends join as guests, no
            accounts required.
          </p>
          <Button variant="secondary" onClick={copyInvite} className="w-full">
            <Copy className="h-4 w-4" />
            {copied ? "Copied" : "Copy invite link"}
          </Button>
        </Card>

        <Card>
          <h2 className="mb-2 text-base font-semibold text-stone-900">
            Privacy
          </h2>
          <p className="text-sm text-stone-600">
            Your exact starting point is only used to calculate
            travel estimates. Other participants see distances
            and your display name — never your address or
            coordinates.
          </p>
        </Card>

        <Dialog>
          <DialogTrigger>
            <Button variant="ghost" className="text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> Leave room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Leave this room?</DialogTitle>
              <DialogDescription>
                Your location, preferences and votes will be
                removed. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <Separator />
            <div className="flex justify-end gap-2">
              <DialogTrigger>
                <Button variant="secondary">Stay</Button>
              </DialogTrigger>
              <Button
                variant="danger"
                disabled={leaving}
                onClick={leaveRoom}
              >
                {leaving ? "Leaving…" : "Leave room"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
