const { onRequest } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");

const BACKEND_URL = defineString("BOT_BACKEND_URL");

exports.api = onRequest({ region: "us-central1", timeoutSeconds: 60 }, async (req, res) => {
  let backend;
  try {
    backend = new URL(BACKEND_URL.value());
    if (!["https:", "http:"].includes(backend.protocol)) throw new Error("Unsupported backend protocol");
  } catch (error) {
    console.error("Invalid BOT_BACKEND_URL:", error.message);
    return res.status(503).json({ error: "Bot backend is not configured." });
  }

  const target = new URL(req.originalUrl, backend.origin);
  const headers = new Headers();
  for (const name of ["accept", "content-type", "cookie", "authorization", "user-agent", "x-requested-with"]) {
    const value = req.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-forwarded-host", req.get("host") || "");
  headers.set("x-forwarded-proto", "https");

  const method = req.method.toUpperCase();
  const options = { method, headers, redirect: "manual" };
  if (method !== "GET" && method !== "HEAD") {
    options.body = req.rawBody && req.rawBody.length ? req.rawBody : undefined;
  }

  try {
    const upstream = await fetch(target, options);
    res.status(upstream.status);
    upstream.headers.forEach((value, name) => {
      if (!["connection", "content-encoding", "content-length", "transfer-encoding", "set-cookie"].includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });
    if (typeof upstream.headers.getSetCookie === "function") {
      for (const cookie of upstream.headers.getSetCookie()) res.append("Set-Cookie", cookie);
    } else {
      const cookie = upstream.headers.get("set-cookie");
      if (cookie) res.setHeader("Set-Cookie", cookie);
    }
    const body = Buffer.from(await upstream.arrayBuffer());
    return res.send(body);
  } catch (error) {
    console.error("Bot backend proxy failed:", error);
    return res.status(502).json({ error: "Unable to reach the bot backend." });
  }
});
