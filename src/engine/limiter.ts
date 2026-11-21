import pLimit, { type LimitFunction } from "p-limit";
import { config } from "./config";

/**
 * One limiter for every Claude request (sessions, bios, plans, feedback) across all rooms, so the
 * total load stays under CONCURRENCY however many rooms are active. Shared through globalThis
 * because API routes and server.ts are bundled separately.
 */
const g = globalThis as { __llmLimit?: LimitFunction; __feedbackLimit?: LimitFunction };
export const llmLimit: LimitFunction = (g.__llmLimit ??= pLimit(config.concurrency));
/** Feedback has its own, smaller cap on top (FEEDBACK_CONCURRENCY). */
export const feedbackLimit: LimitFunction = (g.__feedbackLimit ??= pLimit(config.feedbackConcurrency));
