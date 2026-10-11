"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toaster";

export function JoinPrompt({
  roomToken,
  roomName,
  onJoined,
}: {
  roomToken: string;
  roomName: string;
  /** Refreshes room state; rejects when the fetch fails. */
  onJoined: () => Promise<void>;
}) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Set once the join POST succeeds and the server
  // has set the session cookie. From then on the
  // form must never re-POST the join — only the
  // state fetch may be retried.
  const [joined, setJoined] = useState(false);
  const [refreshError, setRefreshError] = useState<
    string | null
  >(null);
  const [retrying, setRetrying] = useState(false);

  async function join(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rooms/${roomToken}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join");
      toast(`Welcome to "${roomName}"`, "success");
      setJoined(true);
      // The cookie is live — load the room through it.
      await onJoined();
    } catch (err) {
      if (joined) {
        // Joined fine, but the state refresh failed.
        // Offer a retry of the fetch, never another
        // join POST.
        setRefreshError(
          err instanceof Error
            ? err.message
            : "Could not load the room.",
        );
      } else {
        toast(
          err instanceof Error ? err.message : "Could not join room",
          "error",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function retryRefresh() {
    setRetrying(true);
    setRefreshError(null);
    try {
      await onJoined();
    } catch (err) {
      setRefreshError(
        err instanceof Error ? err.message : "Could not load the room.",
      );
    } finally {
      setRetrying(false);
    }
  }

  if (joined) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
              <Users className="h-5 w-5 text-brand-700" />
            </span>
            <p className="text-lg font-semibold text-stone-900">
              You&rsquo;re in!
            </p>
            {refreshError ? (
              <>
                <p className="text-sm text-amber-700">
                  The room couldn&rsquo;t be loaded: {refreshError}
                </p>
                <Button onClick={retryRefresh} disabled={retrying}>
                  {retrying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Retrying…
                    </>
                  ) : (
                    "Load the room"
                  )}
                </Button>
              </>
            ) : (
              <p className="flex items-center gap-2 text-sm text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading the room…
              </p>
            )}
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <form onSubmit={join} className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100">
              <Users className="h-5 w-5 text-brand-700" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-stone-900">
                Join &ldquo;{roomName}&rdquo;
              </h1>
              <p className="text-sm text-stone-500">
                No account needed — pick a display name.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="join-name">Display name</Label>
            <Input
              id="join-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sam"
              required
              maxLength={80}
              autoFocus
            />
          </div>
          <Button type="submit" disabled={submitting}>
            <KeyRound className="h-4 w-4" />
            {submitting ? "Joining…" : "Join room"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
