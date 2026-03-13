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
  AlertCircle
} from "lucide-react";

interface DomainMapping {
  id: number;
  domain: string;
  login_url: string;
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

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 2000);
    fetchDomains();
    return () => clearTimeout(timer);
  }, []);

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

      <main className="max-w-6xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Control Panel */}
        <section className="lg:col-span-5 space-y-8">
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
                          <p className="text-sm opacity-60 max-w-md mb-8">
                            The browser has been launched inside the container. For security, some identity providers may block direct embedding.
                          </p>
                          <a 
                            href={launchData.login_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-[#141414] text-white px-8 py-3 font-serif italic text-lg hover:bg-opacity-80 transition-all"
                          >
                            Access Remote Instance
                          </a>
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
                          <p className="text-white opacity-50"># Pulling image browser-image:latest...</p>
                          <p className="text-white opacity-50"># Image up to date.</p>
                          <p className="mt-4 break-all text-white">
                            <span className="text-emerald-400">$</span> {launchData.docker_command}
                          </p>
                          <p className="mt-4 text-emerald-400/80">Container ID: {launchData.container_id}</p>
                          <p className="text-emerald-400/80">Status: Created</p>
                          <p className="text-emerald-400/80">Network: Bridge (172.17.0.0/16)</p>
                          <p className="text-emerald-400/80">Assigned IP: {launchData.ip_address}</p>
                          <p className="mt-4 text-white opacity-50"># Starting Chromium process...</p>
                          <p className="text-white opacity-50"># Chromium started with --no-sandbox --disable-setuid-sandbox</p>
                          <p className="text-white opacity-50"># Navigating to {launchData.login_url}...</p>
                          <p className="text-emerald-400 font-bold mt-4 animate-pulse">READY: LISTENING ON PORT 8080</p>
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
                            animate={{ width: ["12%", "15%", "13%"] }} 
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="h-full bg-emerald-400" 
                          />
                        </div>
                        <span className="text-[9px] font-mono">12.4%</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] uppercase tracking-widest opacity-40">Memory</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            animate={{ width: ["45%", "46%", "45%"] }} 
                            transition={{ repeat: Infinity, duration: 3 }}
                            className="h-full bg-blue-400" 
                          />
                        </div>
                        <span className="text-[9px] font-mono">248MB</span>
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
