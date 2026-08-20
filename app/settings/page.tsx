import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/page";
import { Settings } from "./model.server";

export const loader = () => Settings.get();
export const action = async ({ request }: Route.ActionArgs) =>
  Settings.update(Object.fromEntries(await request.formData()));

// Native Spanish voices only. `pinecall voices --language es` lists the catalogue.
const VOICES = {
  "elevenlabs/carolina-2": "Carolina · España",
  "elevenlabs/sofia-2": "Sofía · Latina, cálida",
  "elevenlabs/nicolas": "Nicolás · España, casual",
  "elevenlabs/antonio": "Antonio · Latino",
};
const LANGUAGES = { es: "Español", en: "English", pt: "Português" };

const field = "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-[15px] outline-none transition focus:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:focus:border-neutral-600";

export default function SettingsPage({ loaderData: s, actionData }: Route.ComponentProps) {
  const saving = useNavigation().state === "submitting";

  return (
    <Form method="post" className="space-y-8">
      <div>
        <h1 className="text-2xl tracking-tight">{s.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">Se aplica al instante. La próxima llamada nace con estos ajustes.</p>
      </div>

      <div className="space-y-5">
        <Field label="Nombre"><input name="name" defaultValue={s.name} className={field} /></Field>
        <Field label="Saludo" hint="la primera frase de cada llamada"><textarea name="greeting" rows={2} defaultValue={s.greeting} className={field} /></Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Voz">
            <select name="voice" defaultValue={s.voice} className={field}>
              {Object.entries(VOICES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          <Field label="Idioma">
            <select name="language" defaultValue={s.language} className={field}>
              {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Horario"><textarea name="hours" rows={2} defaultValue={s.hours} className={field} /></Field>
        <Field label="Servicios" hint="uno por línea"><textarea name="services" rows={5} defaultValue={s.services} className={field} /></Field>
        <Field label="Notas"><textarea name="notes" rows={2} defaultValue={s.notes} className={field} /></Field>
      </div>

      <div className="flex items-center gap-4">
        <button disabled={saving} className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {actionData && <span className="text-sm text-neutral-500">Aplicado</span>}
      </div>
    </Form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-neutral-600 dark:text-neutral-400">
        {label}{hint && <span className="text-neutral-400 dark:text-neutral-500"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}
