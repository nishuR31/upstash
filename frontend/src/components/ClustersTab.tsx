import React, { useState } from "react";
import { Search, Copy, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { DatabaseItem, ToastType } from "../types";

interface ClustersTabProps {
  databases: DatabaseItem[];
  showToast: (msg: string, type?: ToastType) => void;
  copyToClipboard: (text: string, label: string) => void;
  onRequestDelete: (dbName: string) => void;
}

export default function ClustersTab({
  databases,
  showToast,
  copyToClipboard,
  onRequestDelete,
}: ClustersTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSnippetTab, setActiveSnippetTab] = useState<Record<string, string>>({});

  const filtered = databases.filter((db) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (db.name && db.name.toLowerCase().includes(term)) ||
      (db.endpoint && db.endpoint.toLowerCase().includes(term)) ||
      (db.redisUrl && db.redisUrl.toLowerCase().includes(term))
    );
  });

  const getSnippet = (db: DatabaseItem, type: string) => {
    const hasValidToken = db.restToken && db.restToken.length > 15 && !db.restToken.includes("required") && !db.restToken.includes("*");
    const token = hasValidToken ? db.restToken : "YOUR_REST_TOKEN";
    const endpoint = db.endpoint || `${db.name}.upstash.io`;
    const restUrl = db.restUrl || `https://${endpoint}`;
    const tcpUrl = db.redisUrl && !db.redisUrl.includes("required") && !db.redisUrl.includes("****")
      ? db.redisUrl
      : `rediss://default:${token}@${endpoint}:6379`;

    switch (type) {
      case "node":
        return `import { Redis } from '@upstash/redis'\n\nconst redis = new Redis({\n  url: '${restUrl}',\n  token: '${token}',\n})\n\nawait redis.set('foo', 'bar')\nconst data = await redis.get('foo')`;
      case "ioredis":
        return `import Redis from 'ioredis'\n\nconst redis = new Redis("${tcpUrl}")\n\nawait redis.set("foo", "bar")\nconst val = await redis.get("foo")`;
      case "python":
        return `from upstash_redis import Redis\n\nredis = Redis(url="${restUrl}", token="${token}")\nredis.set("foo", "bar")\nprint(redis.get("foo"))`;
      case "curl":
        return `curl -H "Authorization: Bearer ${token}" ${restUrl}/set/foo/bar\ncurl -H "Authorization: Bearer ${token}" ${restUrl}/get/foo`;
      case "env":
        return `UPSTASH_REDIS_REST_URL="${restUrl}"\nUPSTASH_REDIS_REST_TOKEN="${token}"\nREDIS_URL="${tcpUrl}"`;
      case "cli":
      default:
        return `redis-cli --tls -u ${tcpUrl}`;
    }
  };

  return (
    <section className="space-y-6 animate-slide-in">
      <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h2 className="text-xl font-extrabold text-white">Database Credentials & Connection Hub</h2>
            <p className="text-xs text-slate-400 mt-1">Access connection strings, REST keys, SDK configuration, and CLI snippets for your Upstash databases.</p>
          </div>

          <div className="relative min-w-[280px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search clusters by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono transition-all"
            />
          </div>
        </div>

        <div className="space-y-6">
          {filtered.length === 0 ? (
            <div className="text-center py-12 glass-card rounded-2xl p-8 border border-white/10 text-slate-400 text-sm">
              <p>No databases found matching search filter.</p>
            </div>
          ) : (
            filtered.map((db, idx) => {
              const hasValidToken = db.restToken && db.restToken.length > 15 && !db.restToken.includes("required") && !db.restToken.includes("*");
              const activeTabType = activeSnippetTab[db.name] || "cli";
              const currentSnippet = getSnippet(db, activeTabType);

              return (
                <div key={db.name + idx} className="glass-card rounded-2xl p-6 space-y-5 border border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-extrabold text-white">{db.name}</h3>
                        <span className="text-[10px] font-semibold text-slate-400 bg-white/5 px-2.5 py-0.5 rounded-md border border-white/10">
                          {db.region || "us-east-1"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">Upstash Serverless Redis Cluster & Direct REST API</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {!db.locked && (
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
                          onClick={() => onRequestDelete(db.name)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Link</span>
                        </button>
                      )}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ACTIVE & ONLINE
                      </span>
                    </div>
                  </div>

                  {/* Grid Info Boxes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-950/60 p-4 rounded-xl border border-white/10 font-mono text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px] font-sans block">Endpoint Hostname:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={`https://${db.endpoint || `${db.name}.upstash.io`}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 font-semibold break-all hover:underline"
                        >
                          {db.endpoint || `${db.name}.upstash.io`}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(db.endpoint || `${db.name}.upstash.io`, "Endpoint")}
                          className="text-[10px] text-cyan-400 hover:text-white px-2 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px] font-sans block">TCP Port:</span>
                      <span className="text-white font-semibold">6379 (SSL Enabled)</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[11px] font-sans block">REST Endpoint URL:</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={db.restUrl || `https://${db.endpoint}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-300 font-semibold break-all hover:underline"
                        >
                          {db.restUrl || `https://${db.endpoint}`}
                        </a>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(db.restUrl || `https://${db.endpoint}`, "REST URL")}
                          className="text-[10px] text-cyan-400 hover:text-white px-2 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3 space-y-1">
                      <span className="text-slate-400 text-[11px] font-sans block">REST Authorization Token:</span>
                      {hasValidToken ? (
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-cyan-400 font-semibold break-all">{db.restToken}</span>
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-lg text-[11px] font-sans font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
                            onClick={() => copyToClipboard(db.restToken, "REST Authorization Token")}
                          >
                            Copy Token
                          </button>
                        </div>
                      ) : (
                        <span className="text-amber-400 text-xs inline-flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Token Required / Pending Scraping
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Code Snippets Section */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-400">Client Code Snippets & Credentials:</span>
                      <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                        {[
                          { id: "cli", label: "redis-cli" },
                          { id: "node", label: "Node.js (@upstash/redis)" },
                          { id: "ioredis", label: "ioredis" },
                          { id: "python", label: "Python" },
                          { id: "curl", label: "cURL REST" },
                          { id: "env", label: ".env Format" },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                              activeTabType === tab.id
                                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                                : "bg-white/5 text-slate-400 border border-white/10 hover:text-white hover:bg-white/10"
                            }`}
                            onClick={() => setActiveSnippetTab({ ...activeSnippetTab, [db.name]: tab.id })}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative bg-slate-950 p-4 rounded-xl border border-white/10 overflow-x-auto">
                      <pre className="text-xs text-cyan-300 font-mono whitespace-pre-wrap break-all">{currentSnippet}</pre>
                      <button
                        type="button"
                        className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-sans font-semibold bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 border border-white/10 transition-all flex items-center gap-1.5"
                        onClick={() => copyToClipboard(currentSnippet, "Code Snippet")}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
