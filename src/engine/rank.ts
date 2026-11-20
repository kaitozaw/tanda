import type { Post } from "./types";
import { rules } from "./config";

/** Internal ranking for recommended slots (not the points score). */
export function rank(post: Post): number {
  const w = rules.rankWeights;
  const engagement = w.like * post.counts.like + w.repost * post.counts.repost + w.reply * post.counts.reply;
  const simAgeHours = (post.roundsSeen * rules.simMinutesPerRound) / 60;
  return (1 + engagement) / Math.pow(simAgeHours + 2, 1.5);
}
