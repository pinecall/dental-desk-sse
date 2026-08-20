import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRevalidator } from "react-router";
import type { VoiceSession } from "@pinecall/web/core";
import type { Route } from "./+types/page";
import { Call, type CallRow, type Line } from "./model.server";

export const loader = () => ({ calls: Call.recent(), phone: process.env.PHONE ?? null });

export default function CallsPage({ loaderData }: Route.ComponentProps) {
  // While the browser is on a call, the live panel below would show the same
  // call a second time (the server's view of it) — so it steps aside.
  const [browserLive, setBrowserLive] = useState(false);
  return (
    <div className="space-y-14">
      <Doors phone={loaderData.phone} />
      <BrowserCall onLive={setBrowserLive} />
      <AgentLive hideWebrtc={browserLive} />
      <History calls={loaderData.calls} />
    </div>
  );
}

// ── 1. Two doors into one agent ───────────────────────────────────────
function Doors({ phone }: { phone: string | null }) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl tracking-tight">Llamadas</h1>
      <p className="max-w-xl text-[15px] leading-relaxed text-neutral-500">
        Un agente, dos puertas.{" "}
        {phone ? (
          <>Llamá al <a href={`tel:${phone}`} className="text-neutral-900 underline decoration-neutral-300 underline-offset-4 dark:text-white">{phone}</a> desde tu teléfono,</>
        ) : (
          <>Sin número configurado (<code className="text-sm">PHONE</code> en <code className="text-sm">.env</code>),</>
        )}{" "}
        o probalo desde este navegador.
      </p>
    </section>
  );
}

// ── 2. The browser call — our own button over VoiceSession ────────────
// The transcript here comes straight from the DataChannel: the session keeps a
// `messages` array that mutates as the STT refines and as the bot's words play.
function BrowserCall({ onLive }: { onLive: (live: boolean) => void }) {
  const sessionRef = useRef<VoiceSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import("@pinecall/web/core").then(({ VoiceSession }) => {
      sessionRef.current = new VoiceSession({
        agent: "dental-desk",
        tokenProvider: () => fetch("/api/token", { method: "POST" }).then((r) => r.json()),
      });
      setReady(true);
    });
    return () => sessionRef.current?.disconnect();
  }, []);

  const state = useSyncExternalStore(
    (cb) => (ready && sessionRef.current ? sessionRef.current.subscribe(cb) : () => {}),
    () => (ready && sessionRef.current ? sessionRef.current.getState() : IDLE),
    () => IDLE,
  );

  const session = sessionRef.current;
  const live = state.status === "connected";
  useEffect(() => onLive(live), [live, onLive]);

  return (
    <section className="space-y-5">
      <SectionTitle>Desde el navegador</SectionTitle>
      <div className="flex items-center gap-4">
        <button
          disabled={!ready || state.status === "connecting"}
          onClick={() => (live ? session?.disconnect() : session?.connect())}
          className={`rounded-full px-6 py-3 text-sm transition disabled:opacity-50 ${
            live ? "bg-red-600 text-white hover:bg-red-500" : "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          }`}
        >
          {state.status === "connecting" ? "Conectando…" : live ? "Colgar" : "Llamar"}
        </button>
        {live && (
          <>
            <Phase phase={state.phase} />
            <span className="text-sm tabular-nums text-neutral-400">{fmt(state.duration)}</span>
            <button onClick={() => session?.toggleMute()} className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
              {state.isMuted ? "Activar micro" : "Silenciar"}
            </button>
          </>
        )}
        {state.status === "error" && <span className="text-sm text-red-600">No se pudo conectar.</span>}
      </div>
      {state.messages.length > 0 && (
        <ol className="space-y-3">
          {state.messages.map((m) =>
            // The session reports tool calls as system messages ("🔧 Using x…" → "✓ x").
            m.role === "system"
              ? <Bubble key={m.id} who="tool" text={m.text.replace(/^🔧 Using |^✓ /, "").replace(/…$/, "")} draft={m.text.startsWith("🔧")} />
              : <Bubble key={m.id} who={m.role === "user" ? "user" : "bot"} text={m.text} draft={m.isInterim || m.speaking} />,
          )}
        </ol>
      )}
    </section>
  );
}

const IDLE = { status: "idle", phase: "idle", messages: [], isMuted: false, duration: 0 } as unknown as ReturnType<VoiceSession["getState"]>;

// ── 3. What the agent is handling right now — over SSE ────────────────
// Phone calls never touch this browser, so this is the only way to see them.
type Live = { call: CallRow; state: string; lines: Line[]; userDraft: string; botDraft: string };

function AgentLive({ hideWebrtc }: { hideWebrtc: boolean }) {
  const [live, setLive] = useState<Live | null>(null);

  useEffect(() => {
    const events = new EventSource("/api/events");
    const on = (name: string, fn: (d: any) => void) => events.addEventListener(name, (e) => fn(JSON.parse(e.data)));
    on("call.started", (call: CallRow) => setLive({ call, state: "listening", lines: [], userDraft: "", botDraft: "" }));
    on("turn", ({ state }) => setLive((l) => l && { ...l, state }));
    on("user.speaking", ({ text }) => setLive((l) => l && { ...l, userDraft: text }));
    on("bot.word", ({ text }) => setLive((l) => l && { ...l, botDraft: text }));
    on("transcript", (line: Line) => setLive((l) => l && { ...l, lines: [...l.lines, line], userDraft: "", botDraft: "" }));
    on("call.ended", () => setLive(null));
    return () => events.close();
  }, []);

  const ownCall = live?.call.transport === "webrtc" && hideWebrtc;

  return (
    <section className="space-y-5">
      <SectionTitle>En el agente ahora</SectionTitle>
      {!live || ownCall ? (
        <p className="text-sm text-neutral-400">
          {ownCall ? "Tu llamada de arriba, vista desde el servidor — misma conversación." : "Ninguna llamada en curso. Cuando entre una por teléfono, aparece acá."}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 text-sm">
            <Phase phase={live.state} />
            <span className="text-neutral-400">{live.call.from} · {live.call.transport}</span>
          </div>
          <ol className="space-y-3">
            {live.lines.map((l, i) => <Bubble key={i} who={l.who} text={l.text} />)}
            {live.userDraft && <Bubble who="user" text={live.userDraft} draft />}
            {live.botDraft && <Bubble who="bot" text={live.botDraft} draft />}
          </ol>
        </>
      )}
    </section>
  );
}

// ── 4. Every call the agent took ──────────────────────────────────────
function History({ calls }: { calls: CallRow[] }) {
  const { revalidate } = useRevalidator();

  useEffect(() => {
    // The log is written server-side; re-run the loader when a call ends.
    const events = new EventSource("/api/events");
    events.addEventListener("call.ended", () => revalidate());
    return () => events.close();
  }, [revalidate]);

  return (
    <section className="space-y-4">
      <SectionTitle>Historial</SectionTitle>
      {calls.length === 0 && <p className="text-sm text-neutral-400">Todavía no hubo llamadas.</p>}
      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {calls.map((c) => <PastCall key={c.id} call={c} />)}
      </ul>
    </section>
  );
}

function PastCall({ call }: { call: CallRow }) {
  const when = new Date(call.startedAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  const secs = call.endedAt ? Math.round((call.endedAt - call.startedAt) / 1000) : null;
  return (
    <li>
      <details className="py-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm">
          <span className="flex items-center gap-3">
            <span className="tabular-nums text-neutral-400">{when}</span>
            <span>{call.from}</span>
            <span className="text-neutral-400">{call.transport}</span>
          </span>
          <span className="tabular-nums text-neutral-400">
            {secs !== null ? fmt(secs) : "en curso"} · {call.lines.length} líneas
          </span>
        </summary>
        <ol className="mt-4 space-y-3">
          {call.lines.length === 0 && <p className="text-sm text-neutral-400">Sin transcripción.</p>}
          {call.lines.map((l, i) => <Bubble key={i} who={l.who} text={l.text} />)}
        </ol>
      </details>
    </li>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────
const PHASES: Record<string, [string, string]> = {
  listening:   ["Escuchando",   "bg-emerald-500 animate-pulse"],
  thinking:    ["Pensando",     "bg-amber-400"],
  pause:       ["Pausa",        "bg-amber-300"],
  speaking:    ["Hablando",     "bg-accent"],
  interrupted: ["Interrumpido", "bg-neutral-400"],
  idle:        ["En espera",    "bg-neutral-300"],
};

function Phase({ phase }: { phase: string }) {
  const [label, dot] = PHASES[phase] ?? PHASES.idle;
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs uppercase tracking-[0.12em] text-neutral-400">{children}</h2>;
}

function Bubble({ who, text, draft }: { who: Line["who"]; text: string; draft?: boolean }) {
  if (who === "tool") {
    // A tool call: what the agent looked up, centred and quiet.
    return (
      <li className="flex justify-center">
        <code className={`rounded-full bg-neutral-200/60 px-3 py-1 font-mono text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 ${draft ? "opacity-50" : ""}`}>
          ⚙ {text}
        </code>
      </li>
    );
  }
  const user = who === "user";
  return (
    <li className={`flex ${user ? "justify-end" : "justify-start"}`}>
      <p className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
        user ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-white ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-800"
      } ${draft ? "opacity-50" : ""}`}>{text || "…"}</p>
    </li>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
