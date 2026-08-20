import { Pinecall, tool } from "@pinecall/sdk";
import { createRequire } from "node:module";
import { z } from "zod";
import { Appointment } from "~/appointments/model.server";
import { Call } from "~/calls/model.server";
import { Settings, type SettingsRow } from "~/settings/model.server";
import { bus } from "~/lib/bus.server";
import { PROMPT, vars } from "./prompt";

// PINECALL_LOG=./pinecall.log makes the SDK write every wire event it receives.
// Its file logger reaches for `require`, which an ESM bundle does not have —
// give it one, or the option silently does nothing.
if (process.env.PINECALL_LOG) (globalThis as any).require ??= createRequire(import.meta.url);

// ── Tools ─────────────────────────────────────────────────────────────
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD. Resolve 'mañana' or 'el jueves' yourself.");
const time = z.string().regex(/^\d{2}:\d{2}$/).describe("HH:MM, 24h");

const checkAvailability = tool({
  name: "check_availability",
  description: "Free slots on a date. Always call this before proposing a time.",
  schema: z.object({ date }),
  execute: traced("check_availability", async ({ date }: { date: string }) => {
    const { open, slots } = Appointment.free(date);
    return open ? { open, slots: slots.slice(0, 3), total: slots.length } : { open };
  }),
});

const bookAppointment = tool({
  name: "book_appointment",
  description: "Book a slot you have already checked is free.",
  schema: z.object({ date, time, patient: z.string().min(2), service: z.string().min(2) }),
  execute: traced("book_appointment", async (appointment: { date: string; time: string; patient: string; service: string }) => {
    try {
      return { booked: true, ...Appointment.create(appointment) };
    } catch (err) {
      return { booked: false, reason: (err as Error).message };
    }
  }),
});

// A tool call is part of the conversation: one line in the log with what was
// asked and what came back, so the call page (and the history) show the agent
// actually looked something up instead of making it up.
function traced<A, R>(name: string, run: (args: A) => Promise<R>) {
  return async (args: A, call: any) => {
    const result = await run(args);
    const text = `${name} ${short(args)} → ${short(result)}`;
    log("tool", call, text);
    if (call?.id) Call.line(call.id, "tool", text);
    return result;
  };
}
const short = (v: unknown) => JSON.stringify(v).replace(/"/g, "").slice(0, 80);

// ── Config ────────────────────────────────────────────────────────────
// The top half comes from the form. The bottom half comes from a pull request.
const config = (s: SettingsRow) => ({
  greeting: s.greeting,
  voice: s.voice,
  language: s.language,
  promptVars: vars(s),

  prompt: PROMPT,
  timezone: "Europe/Madrid",
  llm: "openai/gpt-5.4-nano",
  stt: "deepgram/flux",
  tools: [checkAvailability, bookAppointment],
  phoneNumber: process.env.PHONE,
});

// Every event the agent receives is logged as `name · call · detail`, so a
// phone call can be followed from the terminal.
const log = (name: string, call: any, detail = "") =>
  console.log(`  ${name.padEnd(16)} ${String(call?.id ?? "").slice(0, 12).padEnd(12)} ${detail}`);

// ── Agent ─────────────────────────────────────────────────────────────
export function startAgent() {
  const pc = new Pinecall();
  const agent = pc.agent("dental-desk", config(Settings.get()));

  // The form saved → the next call is born with it.
  bus.on("settings", (s) => agent.update(config(s)));

  // ── The call log and the live page ──────────────────────────────────
  // Call.* writes the log and mirrors each step on the bus; `turn` is the
  // moment-to-moment state the live page shows and nobody needs to keep.
  const turn = (call: any, state: string) => (log("turn", call, state), bus.emit("turn", { id: call.id, state }));

  agent.on("call.started", (call) => {
    log("call.started", call, `${call.from ?? "browser"} · ${call.transport}`);
    Call.start({ id: call.id, from: call.from ?? "navegador", transport: call.transport });
  });
  agent.on("chat.started" as any, (call: any) => {
    log("chat.started", call);
    Call.start({ id: call.id, from: "chat", transport: "chat" });
  });
  agent.on("call.ended", (call, reason) => (log("call.ended", call, reason), Call.end(call.id, reason)));

  // The user's side: interim words while they speak, one final line per turn.
  agent.on("speech.started", (_, call) => turn(call, "listening"));
  agent.on("user.speaking", ({ text }, call) => (log("user.speaking", call, text), bus.emit("user.speaking", { id: call.id, text })));
  agent.on("user.message", ({ text }, call) => (log("user.message", call, text), Call.line(call.id, "user", text)));
  agent.on("eager.turn", (_, call) => turn(call, "thinking"));
  agent.on("turn.pause" as any, (_: unknown, call: any) => turn(call, "pause"));  // SmartTurn: a pause, not the end
  agent.on("turn.end", (_, call) => turn(call, "thinking"));
  agent.on("turn.continued", (_, call) => turn(call, "listening"));
  agent.on("llm.toolCall", ({ toolCalls }, call) => log("llm.toolCall", call, toolCalls.map((t) => t.name).join(", ")));

  // The bot's side. One rule: the bot's line is what has been SAID. On voice,
  // bot.speaking may carry the whole text up front (the phone does, for the
  // greeting) but it is not shown until the audio plays — bot.word grows a
  // draft, bot.finished closes it with call.currentBotText. Chat has no audio
  // and no words, so there bot.speaking is the line.
  const voice = (call: any) => call.transport !== "chat";
  agent.on("bot.speaking", ({ text }, call) => {
    log("bot.speaking", call, text ? `"${text.slice(0, 50)}"` : "(streaming)");
    turn(call, "speaking");
    if (voice(call)) bus.emit("bot.word", { id: call.id, text: "" });
    else Call.line(call.id, "bot", text);
  });
  agent.on("bot.word", ({ word }, call) => {
    process.stdout.write(word + " ");
    bus.emit("bot.word", { id: call.id, text: call.currentBotText });
  });
  agent.on("bot.finished", (_, call) => {
    console.log();
    log("bot.finished", call, `"${call.currentBotText.slice(0, 50)}"`);
    turn(call, "listening");
    if (voice(call) && call.currentBotText) Call.line(call.id, "bot", call.currentBotText);
  });
  agent.on("bot.interrupted", (_, call) => {
    console.log();
    log("bot.interrupted", call, `"${call.currentBotText.slice(0, 50)}"`);
    turn(call, "interrupted");
    if (call.currentBotText) Call.line(call.id, "bot", `${call.currentBotText} —`);
  });

  console.log(`  agent dental-desk · ${process.env.PHONE ?? "browser only"}`);
  return agent;
}
