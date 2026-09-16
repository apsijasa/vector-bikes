import { useEffect, useMemo, useReducer, useRef } from "preact/hooks";
import { BookingFields, FIELD_IDS } from "./BookingFields.tsx";
import { BlockFieldset, DayFieldset, ModeFieldset } from "./BookingSchedule.tsx";
import { BookingTicket } from "./BookingTicket.tsx";
import {
  type ApiDay,
  type BookingResult,
  type FormValues,
  type Mode,
  bookingReducer,
  initialState,
  normalizePhone,
  selectedBlocks,
  validateForm,
} from "./booking-state.ts";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      language: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
    },
  ) => void;
  reset: () => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TIMEZONE = "America/Santiago";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function todayInSantiago(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

export default function BookingIsland({ siteKey }: { siteKey: string }) {
  const [state, dispatch] = useReducer(bookingReducer, initialState);
  const today = useMemo(todayInSantiago, []);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const days = state.availability.status === "ready" ? state.availability.days : [];
  const day = days.find((item) => item.date === state.selectedDate);
  const chosen = selectedBlocks(state);
  const isPickup = state.mode === "retiro";

  async function loadAvailability(mode: Mode): Promise<void> {
    dispatch({ type: "loadStart" });
    try {
      const response = await fetch(
        `/api/disponibilidad?desde=${todayInSantiago()}&dias=14&modo=${mode}`,
      );
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      const payload = (await response.json()) as { days: ApiDay[]; capacity: number };
      dispatch({ type: "loadSuccess", days: payload.days, capacity: payload.capacity });
    } catch {
      dispatch({ type: "loadError" });
    }
  }

  useEffect(() => {
    void loadAvailability(state.mode);
  }, [state.mode]);

  useEffect(() => {
    if (siteKey === "") {
      return;
    }
    const mount = () => {
      if (window.turnstile && turnstileRef.current) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: siteKey,
          language: "es",
          callback: (token) => dispatch({ type: "setTurnstile", token }),
          "expired-callback": () => dispatch({ type: "setTurnstile", token: null }),
        });
      }
    };
    if (window.turnstile) {
      mount();
      return;
    }
    const script = document.createElement("script");
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.addEventListener("load", mount);
    document.head.append(script);
  }, [siteKey]);

  function focusFirstError(errors: Partial<Record<keyof FormValues | "bloque", string>>): void {
    const first = (Object.keys(FIELD_IDS) as (keyof FormValues)[]).find((key) => errors[key]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#${FIELD_IDS[first]}`)?.focus();
    }
  }

  function requestBody(): string {
    return JSON.stringify({
      mode: state.mode,
      service_date: state.selectedDate,
      start: state.selectedStart,
      nombre: state.form.nombre.trim(),
      telefono: normalizePhone(state.form.telefono) ?? state.form.telefono,
      correo: state.form.correo.trim(),
      bicicleta: state.form.bicicleta.trim(),
      descripcion: state.form.descripcion.trim(),
      ...(isPickup ? { comuna: state.form.comuna, direccion: state.form.direccion.trim() } : {}),
      consentimiento: state.form.consentimiento,
      turnstile_token: state.turnstileToken ?? "",
    });
  }

  async function submit(event: Event): Promise<void> {
    event.preventDefault();
    const errors = validateForm(state);
    if (Object.keys(errors).length > 0) {
      dispatch({
        type: "submitFailed",
        status: 422,
        body: { fields: errors as Record<string, string> },
      });
      focusFirstError(errors);
      return;
    }
    dispatch({ type: "submitStart" });
    try {
      const response = await fetch("/api/reservas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestBody(),
      });
      const body = (await response.json()) as BookingResult & {
        error?: string;
        fields?: Record<string, string>;
      };
      if (response.status === 201) {
        dispatch({ type: "submitSuccess", result: body });
        return;
      }
      dispatch({ type: "submitFailed", status: response.status, body });
      window.turnstile?.reset();
      if (response.status === 409) {
        void loadAvailability(state.mode);
      }
    } catch {
      dispatch({ type: "submitFailed", status: 0, body: {} });
      window.turnstile?.reset();
    }
  }

  return (
    <form class="booking" id="booking" novalidate ref={formRef} onSubmit={submit}>
      <div class="stage">
        <ModeFieldset mode={state.mode} onMode={(mode) => dispatch({ type: "setMode", mode })} />
        <DayFieldset
          availability={state.availability}
          days={days}
          selectedDate={state.selectedDate}
          today={today}
          onPick={(date) => dispatch({ type: "selectDate", date })}
          onRetry={() => void loadAvailability(state.mode)}
        />
        <BlockFieldset
          day={day}
          chosen={chosen}
          isPickup={isPickup}
          error={state.errors.bloque}
          onPick={(start) => dispatch({ type: "selectStart", start })}
        />
        <BookingFields
          form={state.form}
          errors={state.errors}
          isPickup={isPickup}
          turnstileRef={turnstileRef}
          onField={(field, value) => dispatch({ type: "setField", field, value })}
        />
      </div>
      <BookingTicket state={state} chosen={chosen} isPickup={isPickup} />
    </form>
  );
}
