import { revokeSession } from "./session-service";

export async function logoutSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  await revokeSession(sessionId, userId);
}