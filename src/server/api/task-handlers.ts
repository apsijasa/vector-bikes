import { timingSafeEqual } from "node:crypto";
import { getTasksEnv } from "../../lib/env.ts";
import { errorMessage, log } from "../../lib/log.ts";
import type { AppDb } from "../db/client.ts";
import { sendReminders } from "../email/reminders.ts";
import { jsonResponse } from "./handlers.ts";

export function isAuthorizedTask(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function taskGuard(request: Request, task: string, suppliedSecret?: string): Response | null {
  if (request.method !== "POST") {
    return jsonResponse(405, { ok: false, error: "method_not_allowed" });
  }
  let secret: string | undefined;
  try {
    secret = suppliedSecret ?? getTasksEnv().TASKS_SECRET;
  } catch {
    log.error("tasks.not_configured", { task });
  }
  if (!isAuthorizedTask(request.headers.get("authorization"), secret)) {
    log.warn("tasks.unauthorized", { task });
    return jsonResponse(401, { ok: false, error: "unauthorized" });
  }
  return null;
}

export async function handleRemindersTask(
  request: Request,
  db: AppDb,
  now: Date,
  deps: { secret?: string; send?: typeof sendReminders } = {},
): Promise<Response> {
  const rejected = taskGuard(request, "reminders", deps.secret);
  if (rejected) return rejected;
  try {
    const { sent, failed } = await (deps.send ?? sendReminders)(db, now);
    return failed === 0
      ? jsonResponse(200, { ok: true, sent })
      : jsonResponse(500, { ok: false, sent, failed });
  } catch (error) {
    log.error("tasks.reminders_failed", { message: errorMessage(error) });
    return jsonResponse(500, { ok: false, error: "internal_error" });
  }
}
