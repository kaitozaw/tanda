// Minimal word filter for a projected screen. Matches whole words, case-insensitive.
const BLOCKED = [
  "fuck", "fucking", "shit", "cunt", "bitch", "bastard", "dick", "pussy", "slut", "whore", "fag", "faggot",
  "nigger", "nigga", "retard", "retarded", "kys", "rape", "nazi",
];
const re = new RegExp(`\\b(${BLOCKED.join("|")})\\b`, "i");

export const isBlocked = (text: string) => re.test(text.replace(/[^a-zA-Z\s]/g, " "));
