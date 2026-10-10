import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  hashSessionToken,
  newRoomToken,
  newSessionToken,
} from "@/lib/auth/session";

describe("session tokens", () => {
  it("generates unique, unguessable session tokens", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("generates short URL-safe room tokens", () => {
    const token = newRoomToken();
    expect(token.length).toBe(12);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(newRoomToken()).not.toBe(token);
  });

  it("hashes tokens so only the hash is stored", () => {
    const hash = hashSessionToken("abc");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("abc");
  });

  it("compares hashes in constant time", () => {
    const hash = hashSessionToken("secret-token");
    expect(constantTimeEqual(hash, hashSessionToken("secret-token"))).toBe(true);
    expect(constantTimeEqual(hash, hashSessionToken("other"))).toBe(false);
    expect(constantTimeEqual(hash, "short")).toBe(false);
  });
});
