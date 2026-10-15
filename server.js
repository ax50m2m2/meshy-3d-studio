import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();
const app = express();
const PORT = Number(process.env.PORT || 8080);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESHY_BASE = "https://api.meshy.ai";

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(process.env.MESHY_API_KEY) });
});

app.use("/api/meshy", async (req, res) => {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "服务端尚未配置 Meshy API Key。请在部署平台环境变量中设置 MESHY_API_KEY。"
    });
  }

  const allowed = [
    /^\/text-to-3d$/,
    /^\/text-to-3d\/[a-zA-Z0-9_-]+$/,
    /^\/image-to-3d$/,
    /^\/image-to-3d\/[a-zA-Z0-9_-]+$/
  ];
  if (!allowed.some((pattern) => pattern.test(req.path))) {
    return res.status(404).json({ error: "不支持的 API 路径。" });
  }
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ error: "不支持的请求方法。" });
  }

  try {
    const upstream = await fetch(MESHY_BASE + "/openapi/v2" + req.path, {
      method: req.method,
      headers: {
        Authorization: "Bearer " + apiKey,
        ...(req.method === "POST" ? { "Content-Type": "application/json" } : {})
      },
      ...(req.method === "POST" ? { body: JSON.stringify(req.body ?? {}) } : {})
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    console.error("Meshy upstream request failed:", error?.message || error);
    res.status(502).json({ error: "无法连接 Meshy 服务，请检查服务器网络后重试。" });
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Meshy 3D Studio running on http://0.0.0.0:${PORT}`);
});
