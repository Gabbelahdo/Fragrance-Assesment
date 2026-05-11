import { apiPath } from "./api";

export interface FeedbackPayload {
  rating: number | null;
  comments: string;
  name: string;
  gender: "male" | "female" | "unspecified" | null;
  age: number | null;
  collectionSize: "lt5" | "5to10" | "10plus" | null;
  email: string;
}

/** POST feedback to /feedback — fire-and-forget, never throws. */
export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  try {
    await fetch(apiPath("/feedback"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Feedback is optional — silently swallow network errors
  }
}
