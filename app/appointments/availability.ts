import type { Route } from "./+types/availability";
import { Appointment } from "./model.server";

// GET /api/availability?date=YYYY-MM-DD
export const loader = ({ request }: Route.LoaderArgs) =>
  Response.json(Appointment.free(new URL(request.url).searchParams.get("date") ?? ""));
