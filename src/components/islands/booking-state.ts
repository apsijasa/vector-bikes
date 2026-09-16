export type Mode = "taller" | "retiro";

export type ApiDay = {
  date: string;
  status: "open" | "closed" | "holiday" | "full" | "blocked";
  holidayName: string | null;
  used: number;
  blocks: { start: string; state: "free" | "taken" | "late" | "noroom" }[];
};

export type FormValues = {
  nombre: string;
  telefono: string;
  correo: string;
  bicicleta: string;
  descripcion: string;
  comuna: string;
  direccion: string;
  consentimiento: boolean;
};

export type BookingResult = {
  code: string;
  service_date: string;
  start: string;
  end: string;
  mode: Mode;
  fee: number;
};

export type State = {
  mode: Mode;
  availability:
    | { status: "idle" | "loading" | "error" }
    | { status: "ready"; days: ApiDay[]; capacity: number };
  selectedDate: string | null;
  selectedStart: string | null;
  form: FormValues;
  errors: Partial<Record<keyof FormValues | "bloque", string>>;
  turnstileToken: string | null;
  submit: { status: "idle" | "submitting" | "success" | "failed"; message: string | null };
  result: BookingResult | null;
};

export type Action =
  | { type: "setMode"; mode: Mode }
  | { type: "loadStart" }
  | { type: "loadSuccess"; days: ApiDay[]; capacity: number }
  | { type: "loadError" }
  | { type: "selectDate"; date: string }
  | { type: "selectStart"; start: string }
  | { type: "setField"; field: keyof FormValues; value: string | boolean }
  | { type: "setTurnstile"; token: string | null }
  | { type: "submitStart" }
  | { type: "submitSuccess"; result: BookingResult }
  | {
      type: "submitFailed";
      status: number;
      body: { error?: string; code?: string; fields?: Record<string, string> };
    };

const MESSAGES = {
  turnstile: "No pudimos verificar que eres una persona. Recarga e intenta de nuevo.",
  rate: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
  network: "No pudimos confirmar tu reserva. Intenta de nuevo en un momento.",
  block: "Elige un bloque libre para continuar.",
} as const;

const EMPTY_FORM: FormValues = {
  nombre: "",
  telefono: "",
  correo: "",
  bicicleta: "",
  descripcion: "",
  comuna: "",
  direccion: "",
  consentimiento: false,
};

export const initialState: State = {
  mode: "taller",
  availability: { status: "idle" },
  selectedDate: null,
  selectedStart: null,
  form: EMPTY_FORM,
  errors: {},
  turnstileToken: null,
  submit: { status: "idle", message: null },
  result: null,
};

function dayOf(state: State, date: string): ApiDay | undefined {
  return state.availability.status === "ready"
    ? state.availability.days.find((day) => day.date === date)
    : undefined;
}

/** Respaldo por estado si la API no trae `error`. */
const FALLBACK_BY_STATUS: Record<number, string> = {
  403: MESSAGES.turnstile,
  409: "El bloque ya no está disponible",
  429: MESSAGES.rate,
};

/** El mensaje del servidor manda en 403, 409, 422 y 429; un 422 local no trae `error`. */
function failureMessage(status: number, body: { error?: string; code?: string }): string | null {
  if (status === 422) {
    return body.error ?? null;
  }
  if (status in FALLBACK_BY_STATUS) {
    return body.error ?? FALLBACK_BY_STATUS[status] ?? MESSAGES.network;
  }
  return MESSAGES.network;
}

export function bookingReducer(state: State, action: Action): State {
  switch (action.type) {
    case "setMode":
      return { ...state, mode: action.mode, selectedStart: null, errors: {} };
    case "loadStart":
      return { ...state, availability: { status: "loading" } };
    case "loadSuccess":
      return {
        ...state,
        availability: { status: "ready", days: action.days, capacity: action.capacity },
      };
    case "loadError":
      return { ...state, availability: { status: "error" } };
    case "selectDate": {
      const day = dayOf(state, action.date);
      if (!day || day.status !== "open") {
        return state;
      }
      return { ...state, selectedDate: action.date, selectedStart: null };
    }
    case "selectStart": {
      const day = state.selectedDate === null ? undefined : dayOf(state, state.selectedDate);
      const block = day?.blocks.find((item) => item.start === action.start);
      if (!block || block.state !== "free") {
        return state;
      }
      return {
        ...state,
        selectedStart: action.start,
        errors: { ...state.errors, bloque: undefined },
      };
    }
    case "setField":
      return {
        ...state,
        form: {
          ...state.form,
          [action.field]:
            action.field === "telefono" && typeof action.value === "string"
              ? formatPhoneLocal(action.value)
              : action.value,
        },
        errors: { ...state.errors, [action.field]: undefined },
      };
    case "setTurnstile":
      return { ...state, turnstileToken: action.token };
    case "submitStart":
      return { ...state, submit: { status: "submitting", message: null }, errors: {} };
    case "submitSuccess":
      return {
        ...state,
        submit: { status: "success", message: null },
        result: action.result,
        turnstileToken: null,
      };
    case "submitFailed": {
      const base: State = {
        ...state,
        turnstileToken: null,
        submit: { status: "failed", message: failureMessage(action.status, action.body) },
      };
      if (action.status === 422) {
        return { ...base, errors: { ...(action.body.fields ?? {}) } };
      }
      if (action.status === 409) {
        return { ...base, selectedStart: null };
      }
      return base;
    }
    default:
      return state;
  }
}

/** Mismas reglas y mensajes que el servidor; la autoridad sigue siendo la API. */
export function validateForm(state: State): Partial<Record<keyof FormValues | "bloque", string>> {
  const errors: Partial<Record<keyof FormValues | "bloque", string>> = {};
  const { form } = state;

  if (state.selectedDate === null || state.selectedStart === null) {
    errors.bloque = MESSAGES.block;
  }
  if (form.nombre.trim().length < 2 || form.nombre.trim().length > 80) {
    errors.nombre = "Escribe tu nombre.";
  }
  if (phoneE164(form.telefono) === null) {
    errors.telefono = "Faltan dígitos: son 8 después del +56 9.";
  }
  const correo = form.correo.trim();
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    errors.correo = "Escribe un correo válido, por ejemplo nombre@correo.cl.";
  }
  if (form.bicicleta.trim().length < 2 || form.bicicleta.trim().length > 120) {
    errors.bicicleta = "Cuéntanos la marca y el tipo de bici.";
  }
  if (form.descripcion.trim().length < 5 || form.descripcion.trim().length > 1000) {
    errors.descripcion = "Cuéntanos qué necesita tu bici.";
  }
  if (state.mode === "retiro") {
    if (form.comuna !== "Vitacura" && form.comuna !== "Las Condes") {
      errors.comuna = "Elige Vitacura o Las Condes.";
    }
    if (form.direccion.trim().length < 5 || form.direccion.trim().length > 200) {
      errors.direccion = "Escribe la dirección de retiro.";
    }
  }
  if (!form.consentimiento) {
    errors.consentimiento = "Acepta el aviso de privacidad para confirmar.";
  }
  return errors;
}

/** Dígitos tras el `+56 9` fijo; de un número pegado completo quedan los 8 finales. */
export function phoneLocalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length > 8 ? digits.slice(-8) : digits;
}

/** `12345678` → `1234 5678`, también a medio escribir. */
export function formatPhoneLocal(raw: string): string {
  const digits = phoneLocalDigits(raw);
  return digits.length > 4 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
}

/** `1234 5678` → `+56912345678`, el formato que espera la API. */
export function phoneE164(raw: string): string | null {
  const digits = phoneLocalDigits(raw);
  return digits.length === 8 ? `+569${digits}` : null;
}

/** `retiro` ocupa el bloque elegido y el siguiente. */
export function selectedBlocks(state: State): string[] {
  if (state.selectedStart === null) {
    return [];
  }
  if (state.mode === "taller") {
    return [state.selectedStart];
  }
  const parts = state.selectedStart.split(":");
  const minutes = Number(parts[0]) * 60 + Number(parts[1]) + 30;
  const next = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return [state.selectedStart, next];
}

export function ticketCode(date: string, start: string): string {
  return `VB-${date.slice(2).replaceAll("-", "")}-${start.replace(":", "")}`;
}

/** `$15.000`, sin `toLocaleString` (depende del ICU del navegador). */
export function formatClp(amount: number): string {
  return `$${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}
/** Recargo del retiro, espejo de rules.ts para la vista. */
export const PICKUP_FEE_CLP = 15000;
