const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.HF_MODEL || "openai/gpt-oss-120b:fastest";

const MODES = {
  normal: "Du bist DOUR AI, ein intelligenter KI-Assistent. Antworte auf Deutsch, klar, freundlich und hilfreich.",
  code: "Du bist DOUR AI Coding Expert. Erkläre Programmierung Schritt für Schritt, schreibe korrekten und gut kommentierten Code und hilf beim Finden von Fehlern."
};

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});

  if (req.method === "GET" && req.url === "/health") {
    return send(res, 200, { ok: true, service: "DOUR AI API" });
  }

  if (req.method !== "POST" || req.url !== "/api/chat") {
    return send(res, 404, { error: "Nicht gefunden." });
  }

  const apiKey = process.env.HF_TOKEN;
  if (!apiKey) {
    return send(res, 500, { error: "Der Hugging-Face-Token fehlt auf dem Server. Bitte HF_TOKEN in Render setzen." });
  }

  try {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 50000) return send(res, 413, { error: "Nachricht zu lang." });
    }

    const body = JSON.parse(raw || "{}");
    if (!Array.isArray(body.messages)) {
      return send(res, 400, { error: "Ungültige Nachrichten." });
    }

    const mode = MODES[body.mode] ? body.mode : "normal";
    const messages = [
      { role: "system", content: MODES[mode] },
      ...body.messages
        .slice(-20)
        .filter(m => m && ["user", "assistant"].includes(m.role))
        .map(m => ({
          role: m.role,
          content: String(m.content || "").slice(0, 4000)
        }))
    ];

    if (messages.length < 2 || messages[messages.length - 1].role !== "user") {
      return send(res, 400, { error: "Bitte schreibe zuerst eine Nachricht." });
    }

    const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: false
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.error?.message || data.error || ("HTTP " + response.status);
      return send(res, response.status, { error: "Hugging Face API: " + detail });
    }

    const reply = data.choices?.[0]?.message?.content;
    return send(res, 200, {
      reply: typeof reply === "string" && reply.trim()
        ? reply.trim()
        : "Ich konnte keine Antwort erzeugen."
    });
  } catch (error) {
    return send(res, 500, { error: error.message || "Serverfehler." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("DOUR AI Hugging Face Server gestartet auf Port " + PORT);
});
