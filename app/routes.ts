import { index, prefix, route, type RouteConfig } from "@react-router/dev/routes";

// The whole surface of the app, URL → file. Pages render; api routes answer JSON.
export default [
  index("settings/page.tsx"),
  route("call", "calls/page.tsx"),

  ...prefix("api", [
    route("settings", "settings/api.ts"),
    route("appointments", "appointments/api.ts"),
    route("availability", "appointments/availability.ts"),
    route("events", "calls/events.ts"),
    route("token", "calls/token.ts"),
  ]),
] satisfies RouteConfig;
