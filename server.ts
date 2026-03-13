import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database
  const db = new Database("orchestrator.db");
  db.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE,
      login_url TEXT
    )
  `);

  // Seed default data if empty
  const count = db.prepare("SELECT count(*) as count FROM domains").get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare("INSERT INTO domains (domain, login_url) VALUES (?, ?)");
    insert.run("gmail.com", "https://accounts.google.com");
    insert.run("outlook.com", "https://login.live.com");
    insert.run("yahoo.com", "https://login.yahoo.com");
    insert.run("icloud.com", "https://www.icloud.com");
    insert.run("protonmail.com", "https://account.proton.me/login");
  }

  app.use(express.json());

  // API Routes
  app.get("/api/domains", (req, res) => {
    const domains = db.prepare("SELECT * FROM domains ORDER BY domain ASC").all();
    res.json(domains);
  });

  app.post("/api/domains", (req, res) => {
    const { domain, login_url } = req.body;
    if (!domain || !login_url) {
      return res.status(400).json({ error: "Domain and Login URL are required" });
    }
    try {
      const info = db.prepare("INSERT INTO domains (domain, login_url) VALUES (?, ?)").run(domain, login_url);
      res.json({ id: info.lastInsertRowid, domain, login_url });
    } catch (err) {
      res.status(400).json({ error: "Domain already exists or database error" });
    }
  });

  app.delete("/api/domains/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM domains WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.post("/api/launch-browser", (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const domain = email.split("@")[1];
    if (!domain) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    const row = db.prepare("SELECT login_url FROM domains WHERE domain = ?").get(domain) as { login_url: string } | undefined;
    
    const login_url = row ? row.login_url : "https://www.google.com/search?q=login+for+" + domain;

    const docker_command = `docker run -d \\
  --name ${domain}_browser_${Math.random().toString(36).substring(7)} \\
  -e START_URL="${login_url}" \\
  -e USER_EMAIL="${email}" \\
  -p 8080:80 \\
  browser-image:latest`;

    // Simulate "starting container" logic
    console.log(`[Orchestrator] Executing: ${docker_command}`);

    res.json({
      success: true,
      email,
      domain,
      login_url,
      docker_command,
      container_id: `container_${Math.random().toString(36).substring(7)}`,
      status: "running",
      ip_address: `172.17.0.${Math.floor(Math.random() * 254) + 1}`
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
