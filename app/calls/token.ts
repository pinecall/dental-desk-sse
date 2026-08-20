import { createToken } from "@pinecall/sdk";

// POST /api/token — a short-lived WebRTC token for the browser. The API key stays here.
export const action = async () =>
  Response.json(await createToken({ channel: "webrtc", agentId: "dental-desk", apiKey: process.env.PINECALL_API_KEY! }));
