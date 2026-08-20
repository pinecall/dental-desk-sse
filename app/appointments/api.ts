import type { Route } from "./+types/api";
import { Appointment } from "./model.server";

// GET /api/appointments · POST /api/appointments
export const loader = () => Response.json(Appointment.upcoming());

export const action = async ({ request }: Route.ActionArgs) => {
  try {
    return Response.json(Appointment.create(await request.json()), { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 409 });
  }
};
