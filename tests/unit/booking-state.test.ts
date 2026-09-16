import { describe, expect, it } from "vitest";
import {
  type ApiDay,
  type State,
  bookingReducer,
  formatClp,
  initialState,
  phoneE164,
  selectedBlocks,
  ticketCode,
  validateForm,
} from "../../src/components/islands/booking-state.ts";

function day(date: string, overrides: Partial<ApiDay> = {}): ApiDay {
  return {
    date,
    status: "open",
    holidayName: null,
    used: 1,
    blocks: [
      { start: "15:00", state: "late" },
      { start: "16:00", state: "free" },
      { start: "16:30", state: "free" },
      { start: "17:00", state: "taken" },
    ],
    ...overrides,
  };
}

function ready(days: ApiDay[]): State {
  return {
    ...initialState,
    availability: { status: "ready", days, capacity: 4 },
  };
}

describe("bookingReducer", () => {
  it("limpia el bloque al cambiar de modalidad", () => {
    const state: State = {
      ...ready([day("2026-09-16")]),
      selectedDate: "2026-09-16",
      selectedStart: "16:00",
    };
    expect(bookingReducer(state, { type: "setMode", mode: "retiro" })).toMatchObject({
      mode: "retiro",
      selectedStart: null,
    });
  });

  it("ignora un día que no está abierto", () => {
    const state = ready([
      day("2026-09-18", { status: "holiday", holidayName: "Independencia Nacional", blocks: [] }),
    ]);
    expect(bookingReducer(state, { type: "selectDate", date: "2026-09-18" })).toBe(state);
  });

  it("solo acepta bloques libres", () => {
    const state: State = { ...ready([day("2026-09-16")]), selectedDate: "2026-09-16" };
    expect(bookingReducer(state, { type: "selectStart", start: "17:00" })).toBe(state);
    expect(bookingReducer(state, { type: "selectStart", start: "16:00" }).selectedStart).toBe(
      "16:00",
    );
  });

  it("en retiro ocupa el bloque elegido y el siguiente", () => {
    const state: State = {
      ...ready([day("2026-09-16")]),
      mode: "retiro",
      selectedDate: "2026-09-16",
      selectedStart: "16:00",
    };
    expect(selectedBlocks(state)).toEqual(["16:00", "16:30"]);
  });

  it("valida comuna y consentimiento en retiro", () => {
    const state: State = { ...initialState, mode: "retiro" };
    const errors = validateForm(state);
    expect(errors.comuna).toBe("Elige Vitacura o Las Condes.");
    expect(errors.consentimiento).toBe("Acepta el aviso de privacidad para confirmar.");
  });

  it("libera el bloque y muestra el mensaje del servidor tras un 409", () => {
    const state: State = {
      ...ready([day("2026-09-16")]),
      selectedDate: "2026-09-16",
      selectedStart: "16:00",
    };
    const next = bookingReducer(state, {
      type: "submitFailed",
      status: 409,
      body: { error: "El bloque ya no está disponible", code: "slot_unavailable" },
    });
    expect(next.selectedStart).toBeNull();
    expect(next.submit.message).toBe("El bloque ya no está disponible");
    expect(next.turnstileToken).toBeNull();
  });

  it("arma el código de la orden y el recargo", () => {
    expect(ticketCode("2026-09-16", "16:30")).toBe("VB-260916-1630");
    expect(formatClp(15000)).toBe("$15.000");
  });
});

describe("teléfono con prefijo +56 9", () => {
  const typed = (value: string) =>
    bookingReducer(initialState, { type: "setField", field: "telefono", value }).form.telefono;

  it.each(["+56912345678", "56912345678", "912345678", "12345678"])(
    "normaliza %s pegado a los 8 dígitos finales",
    (pasted) => {
      expect(typed(pasted)).toBe("1234 5678");
      expect(phoneE164(typed(pasted))).toBe("+56912345678");
    },
  );

  it("formatea mientras se escribe y descarta lo que no es dígito", () => {
    expect(typed("123")).toBe("123");
    expect(typed("12345")).toBe("1234 5");
    expect(typed("12a3-4 56")).toBe("1234 56");
  });

  it("7 dígitos siguen siendo inválidos", () => {
    const state: State = {
      ...initialState,
      form: { ...initialState.form, telefono: typed("1234567") },
    };
    expect(phoneE164(state.form.telefono)).toBeNull();
    expect(validateForm(state).telefono).toBe("Faltan dígitos: son 8 después del +56 9.");
  });
});
