# Browser Launch Orchestrator (BLO) — Installation & Production Deployment Guide

This document provides step-by-step instructions for installing, configuring, and deploying **BLO (Browser Launch Orchestrator)** in development and high-performance production environments (such as AWS EC2, Google Compute Engine, or bare-metal Ubuntu servers).

---

## 1. System Requirements & Prerequisites

### Minimum Host Specifications
- **Operating System**: Linux (Ubuntu 22.04 LTS or Debian 12 recommended) for native `iptables` rulesets.
- **CPU**: 2 Cores minimum (4+ Cores recommended for parallel browser container orchestration).
- **Memory**: 4 GB RAM minimum (8 GB+ recommended). *Note: Each spawned active browser container utilizes approximately 512MB - 1GB under load.*
- **Storage**: 20 GB available SSD space (for cache, session auditing logs, and Docker layers).

### Software Requirements
- **Docker Engine** v24.0.0 or higher.
- **Docker Compose** v2.20.0 or higher.
- **Node.js** v20.x or v22.x (LTS releases).
- **npm** v10.x or higher.
- **SQLite3** library on host.

---

## 2. Network Layout & Security (EC2 Security Groups)

Before spawning instances or running the control panel on AWS/GCP, verify your cloud security groups allow the following traffic:

| Port Range | Protocol | Access Type | Description |
|------------|----------|-------------|-------------|
| **22** | TCP | Restricted (My IP) | Secure SSH Admin Terminal Access |
| **80** / **443** | TCP | Public (Anywhere) | Standard HTTP/HTTPS (Nginx reverse proxy) |
| **3000** | TCP | Public or VPN-only | Direct Access to the BLO Web UI / REST Control API |
| **6000 - 7000** | TCP | Public (Anywhere) | VNC/WebSockets for remote inter-container interactions |

---

## 3. Host System Configuration (One-Time Setup)

To allow the orchestrator (Node.js backend) to control local Docker instances without running as the root user, add the workspace/operator user to the host platform's Docker system group.

```bash
# Update local apt indices
sudo apt update && sudo apt upgrade -y

# Verify Docker engine is installed and responsive
docker --version

# Add current user to standard Docker group
sudo usermod -aG docker $USER

# Apply group membership changes immediately without logging out
newgrp docker

# Confirm access without sudo (should return clean output)
docker ps
```

---

## 4. Manual Installation & Compilation (Step-by-Step)

### Step A: Clone the Repository
```bash
git clone <your-repository-url> blo-orchestrator
cd blo-orchestrator
```

### Step B: Configure the Environment Profile
Create a production `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` to match your production host's deployment specifications:
```env
PORT=3000
NODE_ENV=production
DOCKER_BROWSER_IMAGE=jlesage/firefox:latest

# CRITICAL FOR REMOTE CLUSTER ACCESS:
# Set this to your EC2 instance's Public IPv4 or resolved DNS domain.
PUBLIC_HOST="3.120.45.67" 
```

### Step C: Install Codebase Dependencies
Run clean installations for full-stack packages:

```bash
npm install
```

### Step D: Build the React Application Front-end
Build the optimized single-page static files which are then hosted directly by the Vite/Express middleware wrapper in production:

```bash
npm run build
```

This compiles all responsive TSX utilities, visual assets, and telemetry panels directly into the `/dist` directory.

---

## 5. Running the Application Workspace

### Option A: Standard CLI (Foreground)
For quick validation, spin the platform up natively:

```bash
# Starts Node server.ts compiling through the tsx layer
npm start
```

### Option B: Systemd Daemon Service (Recommended for Production)
To ensure continuous operation, automatic reboots on kernel crashes, and standard logs parsing via journald, wrap your node instance in a custom systemd unit.

Create `/etc/systemd/system/blo.service`:

```ini
[Unit]
Description=Browser Launch Orchestrator (BLO) Daemon
After=network.target docker.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/blo-orchestrator
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=blo-orchestrator
Environment=NODE_ENV=production PORT=3000 PUBLIC_HOST=3.120.45.67

[Install]
WantedBy=multi-user.target
```

Apply, register, and start the system daemon:
```bash
sudo systemctl daemon-reload
sudo systemctl enable blo.service
sudo systemctl start blo.service

# Verify the orchestration daemon is running perfectly
sudo systemctl status blo.service
```

---

## 6. Nginx Web Server & Reverse Proxy Setup

It is highly recommended to proxy traffic through Nginx to support custom SSL domains and secure WebSocket up-channel upgrades (`ws://`/`wss://` integrations).

### Step 1: Install Nginx
```bash
sudo apt install nginx -y
```

### Step 2: Create Server Profile
Create Nginx configuration block `/etc/nginx/sites-available/blo`:

```nginx
server {
    listen 80;
    server_name your-domain.com; # Replace with your DNS pointing to EC2 IP

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Step 3: Enable Site Profile & Reload Nginx
```bash
sudo ln -s /etc/nginx/sites-available/blo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. Troubleshooting & Production Fallbacks

### Issue 1: Firefox Browser Crashes with `Tab crashed` or `IPC failure`
- **Cause**: Firefox handles parallel pages by utilizing Linux `/dev/shm` (shared memory). By default, Docker containers limit shared memory to just `64MB`.
- **Resolution**: Ensure the container has been allocated a generous `--shm-size=2g` parameter and content sandboxing is bypassed inside the container using the environment variable `MOZ_DISABLE_CONTENT_SANDBOX=1`. The BLO container backend automatically executes with these options natively.

### Issue 2: Directing UI Frame Permissions over Non-Secure (HTTP) Protocol
- **Cause**: Modern browsers restrict webcam, geolocation, and canvas storage bindings on standard HTTP URLs.
- **Resolution**: Route traffic through Nginx with fully encrypted Let's Encrypt HTTPS certificates:
  ```bash
  sudo apt install certbot python3-certbot-nginx -y
  sudo certbot --nginx -d your-domain.com
  ```

### Issue 3: SQLite Database is Locked (`SQLITE_BUSY: database is locked`)
- **Cause**: Occurs of multiple threads lock write sequences concurrently inside heavy audit workflows.
- **Resolution**: BLO wraps the database in persistent system memory using fallback SQLite processes, keeping operations fast, non-blocking, and safely cached.

### Issue 4: WebSocket Connections Rejected in Multi-Cloud Spaces
- **Cause**: Missing reverse-proxy header support for Web Interface upgrades.
- **Resolution**: Verify that the remote client is utilizing correct secure socket protocol variants (`wss://`) and your routing rules explicitly support HTTP header upgrades.
