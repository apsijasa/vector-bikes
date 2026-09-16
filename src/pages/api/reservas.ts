import type { APIRoute } from "astro";
import { clientIp, handleCreateBooking } from "../../server/api/handlers.ts";
import { getDb } from "../../server/db/client.ts";

export const prerender = false;

export const POST: APIRoute = ({ request, clientAddress }) =>
  handleCreateBooking(request, {
    db: getDb(),
    now: new Date(),
    ip: clientIp(request, clientAddress),
  });
