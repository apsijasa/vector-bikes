import type { APIRoute } from "astro";
import { log } from "../../lib/log.ts";
import { clientIp, handleCreateBooking } from "../../server/api/handlers.ts";
import { getDb } from "../../server/db/client.ts";
import { notifyBookingCreated } from "../../server/email/notifications.ts";

export const prerender = false;

// TEMPORAL: diagnóstico de la forma de las cabeceras de IP detrás del proxy de Replit.
// Borrar este bloque (y su llamada) cuando se decida cómo leer la IP real.
function maskIp(value: string): string {
  return value
    .split(",")
    .map((entry) => {
      const ip = entry.trim();
      if (ip.includes(".")) {
        return ip.split(".").slice(0, 2).concat("x", "x").join(".");
      }
      return ip.includes(":") ? `${ip.split(":").slice(0, 2).join(":")}:…` : "?";
    })
    .join(", ");
}

function logIpHeaders(request: Request): void {
  const raw = (name: string) => {
    const value = request.headers.get(name);
    return value === null ? null : maskIp(value);
  };
  log.info("reservas.ip_headers", {
    xForwardedFor: raw("x-forwarded-for"),
    xRealIp: raw("x-real-ip"),
    cfConnectingIp: raw("cf-connecting-ip"),
  });
}

export const POST: APIRoute = ({ request, clientAddress }) => {
  logIpHeaders(request);
  return handleCreateBooking(request, {
    db: getDb(),
    now: new Date(),
    ip: clientIp(request, clientAddress),
    onCreated: notifyBookingCreated,
  });
};
