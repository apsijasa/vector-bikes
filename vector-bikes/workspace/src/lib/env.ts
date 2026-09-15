import { z } from "zod";

type EnvSource = Record<string, string | undefined>;

export class EnvError extends Error {
  readonly variables: string[];

  constructor(variables: string[]) {
    super(`Variable de entorno faltante o inválida: ${variables.join(", ")}`);
    this.name = "EnvError";
    this.variables = variables;
  }
}

function parseSource<T extends z.ZodType>(schema: T, source: EnvSource): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const names = result.error.issues.map((issue) => String(issue.path[0] ?? "desconocida"));
    throw new EnvError([...new Set(names)]);
  }
  return result.data;
}

const required = z.string().trim().min(1);
const secret = z.string().min(32);

const dbSchema = z.object({ DATABASE_URL: required });
const cancelSchema = z.object({ CANCEL_TOKEN_SECRET: secret });
const turnstileSchema = z.object({ TURNSTILE_SECRET_KEY: required });
const hashSchema = z.object({ SESSION_SECRET: secret });
const siteSchema = z.object({ PUBLIC_SITE_URL: z.url() });
const emailSchema = z
  .object({
    EMAIL_TRANSPORT: z.enum(["resend", "console"]),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: required,
    EMAIL_REPLY_TO: z.email(),
    SHOP_NOTIFY_EMAIL: z.email(),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_TRANSPORT === "resend" && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "requerida cuando EMAIL_TRANSPORT=resend",
      });
    }
  });
const adminSetupSchema = z.object({
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(12),
});

export type EmailEnv = z.infer<typeof emailSchema>;

/** Paso 2 en adelante. */
export function getDbEnv(source: EnvSource = process.env) {
  return parseSource(dbSchema, source);
}

/** Paso 4 en adelante. */
export function getCancelEnv(source: EnvSource = process.env) {
  return parseSource(cancelSchema, source);
}

/** Paso 5 en adelante. */
export function getTurnstileEnv(source: EnvSource = process.env) {
  return parseSource(turnstileSchema, source);
}

/** Paso 5 en adelante. */
export function getHashEnv(source: EnvSource = process.env) {
  return parseSource(hashSchema, source);
}

/** Paso 8 en adelante. */
export function getSiteEnv(source: EnvSource = process.env) {
  return parseSource(siteSchema, source);
}

/** Paso 8 en adelante. */
export function getEmailEnv(source: EnvSource = process.env): EmailEnv {
  return parseSource(emailSchema, source);
}

/** Solo scripts/admin-set-password.ts (paso 10). */
export function getAdminSetupEnv(source: EnvSource = process.env) {
  return parseSource(adminSetupSchema, source);
}
