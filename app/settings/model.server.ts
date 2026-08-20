import { db } from "~/lib/db.server";
import { bus } from "~/lib/bus.server";

const DEFAULTS = {
  name: "Clínica Dental Sonrisa",
  greeting: "Clínica Dental Sonrisa, buenos días. ¿En qué puedo ayudarle?",
  voice: "elevenlabs/carolina-2", // a native es-ES voice — an English voice speaking Spanish sounds like a tourist
  language: "es",
  hours: "Lunes a viernes de 9 a 20. Sábados de 10 a 14.",
  services: "Limpieza dental\nEmpaste\nRevisión general\nOrtodoncia\nBlanqueamiento",
  notes: "Para urgencias fuera de horario, el teléfono de guardia es el 600 123 456.",
};

export type SettingsRow = typeof DEFAULTS & { updatedAt?: number };

export const Settings = {
  get(): SettingsRow {
    return { ...DEFAULTS, ...db.settings };
  },

  update(patch: Record<string, unknown>): SettingsRow {
    const next: SettingsRow = { ...this.get(), updatedAt: Date.now() };
    for (const key of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
      if (key in patch) next[key] = String(patch[key]);
    }
    db.settings = next;
    bus.emit("settings", next);
    return next;
  },
};
