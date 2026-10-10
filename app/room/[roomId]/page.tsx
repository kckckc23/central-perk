import Link from "next/link";
import { RoomClient } from "@/components/room/RoomClient";
import { getRoomState } from "@/lib/room-state";
import { Button } from "@/components/ui/button";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

function ErrorCard({
  title,
  message,
  roomId,
}: {
  title: string;
  message: string;
  roomId: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="text-xl font-bold text-stone-900">
          {title}
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          {message}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" asChild>
            <a href={`/room/${roomId}`}>Try again</a>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;

  let result;
  try {
    result = await getRoomState(roomId);
  } catch (err) {
    return (
      <ErrorCard
        roomId={roomId}
        title="Something went wrong"
        message={`${err instanceof Error ? err.message : "Could not load this room."} Is PocketBase running? (See the README.)`}
      />
    );
  }

  if (result.status === "not-found") {
    return (
      <ErrorCard
        roomId={roomId}
        title="Room not found"
        message="This invite link doesn't match any room. Check that the full link was copied, or ask the host to create a new room."
      />
    );
  }

  if (result.status === "expired") {
    return (
      <ErrorCard
        roomId={roomId}
        title="This room has expired"
        message="Rooms expire after 30 days so location data doesn't linger. Ask the host to create a new room."
      />
    );
  }

  return (
    <RoomClient
      initialState={result.state}
      roomToken={result.state.room.token}
    />
  );
}
