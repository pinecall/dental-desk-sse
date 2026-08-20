import { Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration } from "react-router";
import "./app.css";

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3.5 py-1.5 text-sm transition ${isActive ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"}`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Recepción · Clínica Dental</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap" rel="stylesheet" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-full">
        <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <span className="text-sm tracking-tight">🦷 Recepción</span>
          <nav className="flex gap-1 rounded-full bg-neutral-200/60 p-1 dark:bg-neutral-800/60">
            <NavLink to="/" end className={link}>Ajustes</NavLink>
            <NavLink to="/call" className={link}>Llamadas</NavLink>
          </nav>
        </header>
        <main className="mx-auto max-w-3xl px-6 pb-24">{children}</main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}
