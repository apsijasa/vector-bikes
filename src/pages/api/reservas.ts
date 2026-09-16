import type { APIRoute } from "astro";
import { errorMessage, log } from "../../lib/log.ts";
import { clientIp } from "../../server/api/client-ip.ts";
import { handleCreateBooking } from "../../server/api/handlers.ts";
import { getDb } from "../../server/db/client.ts";
import { notifyBookingCreated } from "../../server/email/notifications.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // TEMPORAL: diagnóstico del error de reserva. Quitar el try/catch y logFailure cuando se
  // identifique la causa; el POST vuelve a ser la llamada directa a handleCreateBooking.
  try {
    const response = await handleCreateBooking(request, {
      db: getDb(),
      now: new Date(),
      ip: clientIp(request, clientAddress),
      onCreated: notifyBookingCreated,
    });
    if (response.status !== 201) {
      await logFailure(response);
    }
    return response;
  } catch (error) {
    log.error("reservas.diag", { status: "exception", reason: errorMessage(error) });
    throw error;
  }
};

/** TEMPORAL: código y motivo de cada respuesta distinta de 201 (sin datos personales). */
async function logFailure(response: Response): Promise<void> {
  let body: { code?: string; error?: string; fields?: Record<string, string> } = {};
  try {
    body = await response.clone().json();
  } catch {
    // Cuerpo no JSON: basta con el código HTTP.
  }
  log.warn("reservas.diag", {
    status: response.status,
    code: body.code ?? null,
    reason: body.error ?? null,
    fields: body.fields ? Object.keys(body.fields) : null,
  });
}
