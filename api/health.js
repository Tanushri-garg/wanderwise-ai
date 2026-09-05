// api/health.ts
function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") return res.status(200).end();
    res.statusCode = 200;
    return res.end();
  }
  const payload = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (typeof res.status === "function" && typeof res.json === "function") {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify(payload));
}
export {
  handler as default
};
