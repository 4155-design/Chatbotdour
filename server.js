
const http = require("node:http");

const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

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

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return send(res, 500, {
      error: "Der Gemini-Schlüssel fehlt auf dem Server."
    });
  }

  try {
    let raw = "";

    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 50000) {
        return send(res, 413, { error: "Nachricht zu lang." });
      }
    }

    const body = JSON.parse(raw || "{}");

    if (!Array.isArray(body.messages)) {
      return send(res, 400, { error: "Ungültige Nachrichten." });
    }

    const mode = MODES[body.mode] ? body.mode : "normal";

    const contents = body.messages
      .slice(-20)
      .filter(m => m && ["user", "assistant"].includes(m.role))
      .map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{
          text: String(m.content || "").slice(0, 4000)
        }]
      }));

    if (!contents.length || contents[contents.length - 1].role !== "user") {
      return send(res, 400, {
        error: "Bitte schreibe zuerst eine Nachricht."
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: MODES[mode] }]
          },
          contents
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return send(res, response.status, {
        error: data.error?.message || "Gemini-API-Fehler: " + response.status
      });
    }

    const reply = (data.candidates?.[0]?.content?.parts || [])
      .map(part => part.text || "")
      .join("\n")
      .trim();

    return send(res, 200, {
      reply: reply || "Keine Antwort erhalten."
    });

  } catch (error) {
    return send(res, 500, {
      error: error.message || "Serverfehler."
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("DOUR AI Gemini Server gestartet auf Port " + PORT);
});
