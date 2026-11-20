import { describe, expect, it } from "vitest";
import { sideFromStance } from "@/engine/applyEvents";
import { rules } from "@/engine/config";
import { loadPostSeeds, seedPosts } from "@/engine/seed";
import { Store } from "@/engine/store";
import { makeAgent } from "./helpers";

describe("starter posts", () => {
  it("the demo room has 20 valid starter posts", () => {
    const seeds = loadPostSeeds(rules.roomId);
    expect(seeds).toHaveLength(20);
    for (const s of seeds) {
      expect(["for", "against", "neutral"]).toContain(s.side);
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.text.length).toBeLessThanOrEqual(rules.maxPostChars);
    }
  });

  it("a room without a file has none", () => {
    expect(loadPostSeeds("no-such-room")).toEqual([]);
  });

  it("each post goes to a different active agent on the post's side, oldest first", () => {
    const s = new Store();
    [10, 20, 50, 55, 80, 90].forEach((stance, i) => s.agents.set(`a${i}`, makeAgent(`a${i}`, stance)));
    seedPosts(s, [
      { side: "for", text: "one" },
      { side: "against", text: "two" },
      { side: "neutral", text: "three" },
      { side: "for", text: "four" },
    ], 1_000_000);
    const posts = s.postOrder.map((id) => s.posts.get(id)!);
    expect(posts.map((p) => p.text)).toEqual(["one", "two", "three", "four"]);
    for (const p of posts) {
      expect(p.authorType).toBe("agent");
      expect(sideFromStance(s.agents.get(p.authorId)!.stance)).toBe(p.side);
      expect(p.finalized).toBe(false);
    }
    expect(new Set(posts.map((p) => p.authorId)).size).toBe(4);
    expect(posts[0].createdAt).toBeLessThan(posts[3].createdAt);
  });

  it("skips a post when no agent is left on its side", () => {
    const s = new Store();
    s.agents.set("a0", makeAgent("a0", 90));
    seedPosts(s, [{ side: "for", text: "one" }, { side: "for", text: "two" }]);
    expect(s.posts.size).toBe(1);
  });
});
