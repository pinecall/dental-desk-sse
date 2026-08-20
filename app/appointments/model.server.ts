import { db } from "~/lib/db.server";
import { bus } from "~/lib/bus.server";

export type AppointmentRow = { date: string; time: string; patient: string; service: string; reference: string };

// Opening hours by weekday (0 = Sunday), half-hour slots.
const HOURS: Record<number, [number, number]> = { 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 20], 6: [10, 14] };
const all = () => (db.appointments ?? []) as AppointmentRow[];
const today = () => new Date().toISOString().slice(0, 10);

export const Appointment = {
  free(date: string) {
    const day = new Date(`${date}T12:00:00`);
    const hours = HOURS[day.getDay()];
    if (!date || Number.isNaN(day.getTime()) || !hours) return { date, open: false, slots: [] as string[] };

    const taken = new Set(all().filter((a) => a.date === date).map((a) => a.time));
    const slots: string[] = [];
    for (let h = hours[0]; h < hours[1]; h++) {
      for (const m of ["00", "30"]) {
        const time = `${String(h).padStart(2, "0")}:${m}`;
        if (!taken.has(time)) slots.push(time);
      }
    }
    return { date, open: true, slots };
  },

  create({ date, time, patient, service }: Omit<AppointmentRow, "reference">): AppointmentRow {
    if (!this.free(date).slots.includes(time)) throw new Error(`${date} ${time} is not available`);
    const appointment = { date, time, patient, service, reference: `CD-${date.slice(5).replace("-", "")}${time.replace(":", "")}` };
    db.appointments = [...all(), appointment];
    bus.emit("appointment", appointment);
    return appointment;
  },

  upcoming(): AppointmentRow[] {
    return all()
      .filter((a) => a.date >= today())
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  },
};
