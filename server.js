const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.OPENAI_MODEL || "gpt-6-astra";

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
  if (!process.env.OPENAI_API_KEY) {
    return send(res, 500, { error: "Der KI-Schlüssel fehlt auf dem Server. Bitte OPENAI_API_KEY in Render als geheime Umgebungsvariable einrichten." });
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
    const input = body.messages
      .slice(-20)
      .filter(m => m && ["user", "assistant"].includes(m.role))
      .map(m => ({
        role: m.role,
        content: String(m.content || "").slice(0, 4000)
      }));

    if (!input.length || input[input.length - 1].role !== "user") {
      return send(res, 400, { error: "Bitte schreibe zuerst eine Nachricht." });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: MODES[mode],
        input
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return send(res, response.status, {
        error: data.error?.message || "KI-API-Fehler: " + response.status
      });
    }

    const reply = data.output_text || (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === "output_text")
      .map(item => item.text)
      .join("\n");

    return send(res, 200, { reply: reply || "Keine Antwort erhalten." });
  } catch (error) {
    return send(res, 500, { error: error.message || "Serverfehler." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("DOUR AI Server gestartet auf Port " + PORT);
});
