const http = require("http");
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-6-astra";
const SYSTEM = "Du bist DOUR AI, ein hilfreicher KI-Assistent. Antworte standardmäßig auf Deutsch. Schreibe auf Wunsch vollständigen, gut erklärten Code. Sei freundlich, klar und ehrlich.";

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (req.method !== "POST" || req.url !== "/api/chat") {
    res.writeHead(404, {"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"Nicht gefunden"}));
  }
  if (!process.env.OPENAI_API_KEY) {
    res.writeHead(500, {"Content-Type":"application/json"}); return res.end(JSON.stringify({error:"OPENAI_API_KEY fehlt in den Render-Umgebungsvariablen."}));
  }
  let raw = "";
  req.on("data", chunk => { raw += chunk; if (raw.length > 1e6) req.destroy(); });
  req.on("end", async () => {
    try {
      const body = JSON.parse(raw || "{}");
      const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
      const input = [{role:"system",content:SYSTEM}, ...messages.map(m => ({role:m.role === "assistant" ? "assistant" : "user", content:String(m.content || "").slice(0,12000)}))];
      const api = await fetch("https://api.openai.com/v1/responses", {
        method:"POST",
        headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({model:MODEL,input})
      });
      const data = await api.json();
      if (!api.ok) {
        res.writeHead(api.status, {"Content-Type":"application/json"});
        return res.end(JSON.stringify({error:data.error?.message || "OpenAI API Fehler"}));
      }
      const reply = data.output_text || (data.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text).join("\n") || "Keine Antwort erhalten.";
      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(JSON.stringify({reply}));
    } catch (err) {
      res.writeHead(400, {"Content-Type":"application/json"});
      res.end(JSON.stringify({error:err.message || "Ungültige Anfrage"}));
    }
  });
});
server.listen(PORT, () => console.log("DOUR AI API läuft auf Port " + PORT));
