import { ValidationError } from "./validate.js";

function parseBody(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      throw new ValidationError("Body must be valid JSON");
    }
  }
  throw new ValidationError("Body must be a JSON object");
}

export function endpoint(method, run) {
  return async function handler(req, res) {
    res.setHeader("cache-control", "no-store");
    if (req.method !== method) {
      res.setHeader("allow", method);
      return res.status(405).json({ error: `Use ${method}` });
    }
    try {
      const body = method === "POST" ? parseBody(req.body) : undefined;
      const result = await run(body, req);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
      console.error("api error:", error && error.name);
      return res.status(500).json({ error: "Something went wrong. Please try again." });
    }
  };
}
