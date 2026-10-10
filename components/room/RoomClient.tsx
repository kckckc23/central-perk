"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoomState } from "@/types";
import { RoomHeader } from "@/components/room/RoomHeader";
import { StepsNav, type StepId } from "@/components/room/StepsNav";
import { PeopleStep } from "@/components/room/PeopleStep";
import { LocationStep } from "@/components/room/LocationStep";
import { PreferencesStep } from "@/components/room/PreferencesStep";
import { DiscoverStep } from "@/components/room/DiscoverStep";
import { VoteStep } from "@/components/room/VoteStep";
import { JoinPrompt } from "@/components/room/JoinPrompt";

interface RoomClientProps {
  initialState: RoomState;
  roomToken: string;
}

export function RoomClient({
  initialState,
  roomToken,
}: RoomClientProps) {
  const [state, setState] = useState(initialState);
  const [step, setStep] = useState<StepId>("people");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/rooms/${roomToken}/state`,
        { cache: "no-store" },
      );
      if (res.ok) {
        setState((await res.json()) as RoomState);
      }
    } catch {
      // Keep the stale state; polling retries.
    }
  }, [roomToken]);

  // Documented polling fallback for realtime updates
  // (participant joins, votes, shortlist changes).
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (state.myParticipantId === null) {
    return (
      <JoinPrompt
        roomToken={roomToken}
        roomName={state.room.name}
        onJoined={refresh}
      />
    );
  }

  const me = state.participants.find(
    (p) => p.id === state.myParticipantId,
  );
  if (!me) {
    return (
      <JoinPrompt
        roomToken={roomToken}
        roomName={state.room.name}
        onJoined={refresh}
      />
    );
  }

  const readyCount = state.participants.filter(
    (p) => p.ready,
  ).length;
  const withLocation = state.participants.filter(
    (p) => p.hasLocation,
  ).length;

  return (
    <div className="min-h-screen bg-stone-50">
      <RoomHeader state={state} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <StepsNav
          active={step}
          onSelect={setStep}
          readyCount={readyCount}
          total={state.participants.length}
          withLocation={withLocation}
        />
        <div className="mt-6">
          {step === "people" && (
            <PeopleStep state={state} onChanged={refresh} />
          )}
          {step === "location" && (
            <LocationStep state={state} onChanged={refresh} />
          )}
          {step === "preferences" && (
            <PreferencesStep state={state} onChanged={refresh} />
          )}
          {step === "discover" && (
            <DiscoverStep state={state} onChanged={refresh} />
          )}
          {step === "vote" && (
            <VoteStep state={state} onChanged={refresh} />
          )}
        </div>
      </main>
    </div>
  );
}
