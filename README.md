# Dental Desk

A Pinecall voice agent for a dental clinic. It answers a phone number **and** the
browser as one agent, and its settings live in a web console — change the voice, save,
call again: the new voice answers. Nothing restarts.

One app, one process, one `.env`. Organised by what it does, not by what it is:

```
server.js              the process entry — Vite in dev, the build in prod. Nothing else.
server/app.ts          Express + the React Router handler + startAgent()
server/agent/          pc.agent() with its two tools, and the prompt
app/routes.ts          the whole surface, URL → file
app/settings/          model · page (the form) · api
app/appointments/      model · api · availability
app/calls/             page (live call + agenda) · events (SSE) · token
app/lib/               db (a JSON file) · bus (in-process events)
```

Open a folder and everything about that thing is in it. The API is React Router
resource routes — a file with a `loader`/`action` and no component — so there is no
second router to learn. The agent lives in `server/` because that is what `server/`
means in the [official custom-server template](https://github.com/remix-run/react-router-templates/tree/main/node-custom-server): Node-only code that starts with the process.

## Run it

```bash
git clone https://github.com/pinecall/dental-desk-sse
cd dental-desk-sse && npm install
cp .env.example .env            # paste your key
npm run dev                     # http://localhost:3000
```

Press the call button and talk to it. Change the voice, save, call again.
`PHONE` is optional — without it, everything works in the browser.

## How a change travels

```
form action ──► Settings.update() ──► bus.emit("settings") ──┬──► agent.update()   next call is born with it
                                                            └──► /api/events      every open tab sees it
```

Same process, so the agent hears the bus directly. What goes over the wire is the
other direction: `/api/events` is Server-Sent Events to the browser — `call.started`,
`transcript`, `appointment`, `settings` — which is why the call page moves by itself
when somebody phones in. The WebSocket sibling of this repo carries the same stream
both ways.

## The call page

Two doors into one agent: the phone number in `PHONE`, and a **Llamar** button built on
`VoiceSession` from `@pinecall/web/core` (no widget). While you talk, the transcript
grows word by word; the agent's tool calls appear inline —
`⚙ check_availability {date:…} → {slots:[…]}` — so you can see it looked the slot up.
A second panel, fed by `/api/events`, shows whatever the agent is handling right now,
which is how phone calls show up; and every call lands in the history with its full
transcript.

`PINECALL_LOG=./pinecall.log` in `.env` makes the SDK write every wire frame it
receives — the instrument that found the one real bug of this project (see the
tutorial's build log).

## Where the line is

The form edits name, greeting, voice, language, hours, services, notes. The model, the
STT provider and the tools are in `server/agent/agent.ts`. Settings are data; behaviour
is code.

Tutorial: https://docs.pinecall.io/tutorial/configurable-agent · MIT
