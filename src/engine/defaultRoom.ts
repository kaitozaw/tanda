import type { RoomInput } from "./types";

/**
 * The demo room (plan/DEMONSTRATION.md). Created on boot if it does not exist, under a fixed id so
 * the demo link and QR code never change. Set DEFAULT_ROOM=0 to skip it.
 */
export const DEFAULT_ROOM_ID = "au-u16-ban";

export const DEFAULT_ROOM: RoomInput = {
  title: "Australia's under-16 social media ban",
  kind: "decision",
  region: "Australia",
  targetHint: "Parents of children aged 10–15",
  description:
    "From 10 December 2025, platforms such as TikTok, Instagram, Snapchat, Facebook, X and YouTube must take reasonable steps to stop Australians under 16 from having accounts, or face fines of up to $49.5 million. Parents cannot consent on a child's behalf, and teens and parents are not penalised. Messaging, online gaming, education and health services are exempt. The eSafety Commissioner enforces the law; how platforms check age is left to them.",
};
