"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Coffee,
  Gamepad2,
  Landmark,
  Link2,
  Map as MapIcon,
  MapPin,
  Plus,
  TreePine,
  Users,
  UtensilsCrossed,
  Vote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toaster";
import { APP_NAME, TAGLINE } from "@/lib/config/brand";

const STEPS = [
  {
    icon: Plus,
    title: "Create a room",
    text: "Name your hangout and get a shareable link.",
  },
  {
    icon: MapPin,
    title: "Everyone adds their location",
    text: "Each person picks a starting point on their own device. Exact addresses stay private.",
  },
  {
    icon: MapIcon,
    title: "Discover venues",
    text: "See places that work for the whole group, with honest travel estimates.",
  },
  {
    icon: Vote,
    title: "Shortlist and vote",
    text: "Pick your favourites and confirm the final spot together.",
  },
];

const USE_CASES = [
  { icon: Coffee, label: "Coffee catch-ups" },
  { icon: UtensilsCrossed, label: "Group dinners" },
  { icon: TreePine, label: "Park days" },
  { icon: Gamepad2, label: "Arcades & games" },
  { icon: Landmark, label: "Sightseeing" },
];

export function LandingPage() {
  const router = useRouter();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create room");
      }
      toast("Room created — share the invite link", "success");
      router.push(`/room/${data.room.token}`);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to create room",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function extractRoomId(input: string): string | null {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/\/room\/([A-Za-z0-9_-]+)/);
    if (urlMatch) return urlMatch[1];
    if (/^[A-Za-z0-9_-]{4,64}$/.test(trimmed)) return trimmed;
    return null;
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    const roomId = extractRoomId(joinInput);
    if (!roomId) {
      toast("Paste a full room link or the room code.", "error");
      return;
    }
    router.push(`/room/${roomId}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-brand-600" />
            <span className="text-lg font-bold text-stone-900">
              {APP_NAME}
            </span>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger>
              <Button size="sm">
                <Plus className="h-4 w-4" /> Create a room
              </Button>
            </DialogTrigger>
            <CreateRoomDialog
              roomName={roomName}
              setRoomName={setRoomName}
              displayName={displayName}
              setDisplayName={setDisplayName}
              submitting={submitting}
              onSubmit={createRoom}
            />
          </Dialog>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-4 py-16 text-center sm:py-24">
          <h1 className="text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl">
            {TAGLINE}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-stone-600">
            Create a shared room, add your starting point and
            preferences, and discover meetup spots that work for
            everyone — then vote on the final place.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger>
                <Button size="lg">
                  <Plus className="h-5 w-5" /> Create a room
                </Button>
              </DialogTrigger>
              <CreateRoomDialog
                roomName={roomName}
                setRoomName={setRoomName}
                displayName={displayName}
                setDisplayName={setDisplayName}
                submitting={submitting}
                onSubmit={createRoom}
              />
            </Dialog>
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
              <DialogTrigger>
                <Button size="lg" variant="secondary">
                  <Link2 className="h-5 w-5" /> Join a room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a room</DialogTitle>
                  <DialogDescription>
                    Paste the room link your friend shared, or the room
                    code.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={joinRoom} className="flex flex-col gap-3">
                  <Input
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="https://…/room/AbCdEf12Xy or AbCdEf12Xy"
                    aria-label="Room link or code"
                  />
                  <Button type="submit">
                    <Users className="h-4 w-4" /> Join room
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16">
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="card flex flex-col gap-2 p-5"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <step.icon className="h-5 w-5" />
                  <span className="text-xs text-stone-400">
                    Step {index + 1}
                  </span>
                </span>
                <h2 className="font-semibold text-stone-900">
                  {step.title}
                </h2>
                <p className="text-sm text-stone-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-20">
          <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-stone-500">
            Works for
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {USE_CASES.map((useCase) => (
              <span
                key={useCase.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700"
              >
                <useCase.icon className="h-4 w-4 text-brand-600" />
                {useCase.label}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-8">
        <div className="mx-auto w-full max-w-5xl px-4 text-center text-xs text-stone-500">
          <p>
            {APP_NAME} is open source and uses OpenStreetMap data
            under the ODbL licence. No accounts, no tracking — your
            location never leaves your device except to calculate
            travel estimates for your room.
          </p>
        </div>
      </footer>
    </div>
  );
}

function CreateRoomDialog({
  roomName,
  setRoomName,
  displayName,
  setDisplayName,
  submitting,
  onSubmit,
}: {
  roomName: string;
  setRoomName: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  submitting: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Create a room</DialogTitle>
        <DialogDescription>
          You will get a shareable link. Friends join as guests — no
          accounts needed.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-name">Room name</Label>
          <Input
            id="room-name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Saturday hangout"
            required
            maxLength={120}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="display-name">Your display name</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Alex"
            required
            maxLength={80}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create room"}
        </Button>
      </form>
    </DialogContent>
  );
}
