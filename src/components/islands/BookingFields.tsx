import type { Ref } from "preact";
import type { FormValues, State } from "./booking-state.ts";

export const FIELD_IDS: Record<keyof FormValues, string> = {
  nombre: "f-nombre",
  telefono: "f-tel",
  correo: "f-mail",
  bicicleta: "f-bici",
  descripcion: "f-desc",
  comuna: "f-comuna",
  direccion: "f-dir",
  consentimiento: "f-ok",
};

type FieldsProps = {
  form: FormValues;
  errors: State["errors"];
  isPickup: boolean;
  turnstileRef: Ref<HTMLDivElement>;
  onField: (field: keyof FormValues, value: string | boolean) => void;
};

/** Atributos comunes de cada control: id, nombre, valor y accesibilidad del error. */
function bind(props: FieldsProps, field: Exclude<keyof FormValues, "consentimiento">) {
  const id = FIELD_IDS[field];
  const error = props.errors[field];
  return {
    id,
    name: field,
    value: props.form[field],
    "aria-invalid": error ? ("true" as const) : undefined,
    "aria-describedby": error ? `err-${id}` : undefined,
    onInput: (event: Event) =>
      props.onField(field, (event.currentTarget as HTMLInputElement).value),
  };
}

function Field({
  id,
  label,
  error,
  help,
  hidden,
  full,
  children,
}: {
  id: string;
  label: preact.ComponentChildren;
  error?: string;
  help?: string;
  hidden?: boolean;
  full?: boolean;
  children: preact.ComponentChildren;
}) {
  const classes = ["field", full ? "full" : "", error ? "bad" : ""].filter(Boolean).join(" ");
  return (
    <div class={classes} hidden={hidden}>
      <label for={id}>{label}</label>
      {children}
      {help && !error && <span class="help">{help}</span>}
      {error && (
        <span class="err" id={`err-${id}`}>
          {error}
        </span>
      )}
    </div>
  );
}

export function BookingFields(props: FieldsProps) {
  const { errors, form, isPickup, onField, turnstileRef } = props;
  return (
    <fieldset>
      <legend>
        <span class="mono">4</span> Tus datos
      </legend>
      <div class="fields">
        <Field id="f-nombre" label="Nombre" error={errors.nombre}>
          <input {...bind(props, "nombre")} autocomplete="name" />
        </Field>
        <Field
          id="f-tel"
          label="Teléfono"
          help="Te llamamos a este número si encontramos algo extra."
          error={errors.telefono}
        >
          <input
            {...bind(props, "telefono")}
            type="tel"
            autocomplete="tel"
            inputmode="tel"
            placeholder="+56 9 1234 5678"
          />
        </Field>
        <Field
          id="f-mail"
          label="Correo"
          help="Aquí llega la confirmación y el enlace para cancelar."
          error={errors.correo}
        >
          <input {...bind(props, "correo")} type="email" autocomplete="email" />
        </Field>
        <Field
          id="f-bici"
          label={
            <>
              Bicicleta <em>marca y tipo</em>
            </>
          }
          error={errors.bicicleta}
        >
          <input {...bind(props, "bicicleta")} placeholder="Ej: Trek Marlin 7, MTB" />
        </Field>
        <Field id="f-desc" label="¿Qué necesita tu bici?" full error={errors.descripcion}>
          <textarea
            {...bind(props, "descripcion")}
            placeholder="Ej: los cambios saltan en la corona grande y el freno trasero está blando."
          />
        </Field>
        <Field id="f-comuna" label="Comuna" hidden={!isPickup} error={errors.comuna}>
          <select
            {...bind(props, "comuna")}
            onChange={(event) =>
              onField("comuna", (event.currentTarget as HTMLSelectElement).value)
            }
          >
            <option value="">Selecciona</option>
            <option>Vitacura</option>
            <option>Las Condes</option>
          </select>
        </Field>
        <Field id="f-dir" label="Dirección de retiro" hidden={!isPickup} error={errors.direccion}>
          <input
            {...bind(props, "direccion")}
            autocomplete="street-address"
            placeholder="Calle, número, depto."
          />
        </Field>
        <label class="consent full" for="f-ok">
          <input
            type="checkbox"
            id="f-ok"
            name="consentimiento"
            checked={form.consentimiento}
            aria-invalid={errors.consentimiento ? "true" : undefined}
            aria-describedby={errors.consentimiento ? "err-f-ok" : undefined}
            onChange={(event) =>
              onField("consentimiento", (event.currentTarget as HTMLInputElement).checked)
            }
          />
          <span>
            Acepto que Vector Bikes use estos datos solo para gestionar mi reserva, según el{" "}
            <a href="/privacidad">aviso de privacidad</a>.
          </span>
        </label>
        {errors.consentimiento && (
          <span class="err" id="err-f-ok">
            {errors.consentimiento}
          </span>
        )}
        <div class="field full" ref={turnstileRef}></div>
      </div>
    </fieldset>
  );
}
