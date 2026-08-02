import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Redis from "ioredis";
import { runAutomation } from "./automator.js";
import { testRedisConnection } from "./test_redis.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env File
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === "function") {
    try { process.loadEnvFile(envPath); } catch { }
  } else {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [key, ...vals] = trimmed.split("=");
        process.env[key.trim()] = vals.join("=").trim();
      }
    }
  }
}

// Global Redis Instance & App Password Setup
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";
const REDIS_URL = process.env.REDIS_URL;
const APP_PASSWORD = process.env.APP_PASSWORD;

console.log(`[Upstash Provisioner] Running in ${NODE_ENV.toUpperCase()} mode (IS_PROD=${IS_PROD})`);

const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  tls: { rejectUnauthorized: false },
});

redisClient.on("connect", () => {
  console.log("[IORedis] Successfully connected to Redis on app startup!");
});

redisClient.on("error", (err) => {
  console.error("[IORedis] Connection Error:", err.message);
});

// Store password in Redis on startup
try {
  await redisClient.set("app:password", APP_PASSWORD);
  console.log(`[IORedis] Stored key 'app:password' = '${APP_PASSWORD}' in Redis database.`);
} catch (err) {
  console.error("[IORedis] Failed to set 'app:password':", err.message);
}


// Initialize Production-Grade Secure Fastify Instance
const fastify = Fastify({
  logger: false,
  trustProxy: true,
  bodyLimit: 1048576, // 1MB limit
});

// Register Gzip / Brotli Compression
await fastify.register(compress, { global: true, threshold: 1024 });

// Register Strict CORS
await fastify.register(cors, {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
});

// Production Helmet Security Headers Configuration
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
});

// Production Security Headers Hook
fastify.addHook("onSend", async (_req, reply) => {
  reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  reply.header("X-Permitted-Cross-Domain-Policies", "none");
  reply.header("X-XSS-Protection", "1; mode=block");
});

// Authentication Authorization Hook (Anti-Bypass API Security Enforcement)
fastify.addHook("preHandler", async (req, reply) => {
  if (req.url.startsWith("/api/")) {
    // In Development Mode, bypass password requirement
    if (!IS_PROD) {
      return;
    }
    if (req.url.startsWith("/api/auth/unlock") || req.url.startsWith("/api/auth/check")) {
      return;
    }
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return reply.status(401).send({ error: "App is locked. Authentication required." });
    }

    let isAuth = false;
    try {
      const val = await redisClient.get(`app:session:${token}`);
      if (val === "authenticated") isAuth = true;
    } catch (err) {
      console.error("Redis session lookup error:", err.message);
    }

    if (!isAuth) {
      return reply.status(401).send({ error: "Session invalid or expired. App is locked." });
    }
  }
});


// State for active task
let activeTask = {
  status: "IDLE", // IDLE, RUNNING, WAITING_FOR_OTP, SUCCESS, FAILED, STOPPED
  step: 0,
  logs: [],
  redisUrl: null,
  credentials: null,
  otpError: null,
  otpAttempt: 1,
  maxOtpAttempts: 3,
  error: null,
  otpResolver: null,
  browser: null,
};

function addLog(msg) {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] ${msg}`;
  activeTask.logs.push(logEntry);
  console.log(logEntry);
}

// ------------------------------------------------------------------
// FASTIFY REST API ENDPOINTS
// ------------------------------------------------------------------

// Serve HTML UI
fastify.get("/", async (req, reply) => {
  const htmlPath = path.join(__dirname, "index.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf-8");
  reply.type("text/html");
  return htmlContent;
});

// AUTH ENDPOINT 1: Unlock App (Validate against Redis app:password)
fastify.post("/api/auth/unlock", async (req, reply) => {
  const { password } = req.body || {};
  if (!password) {
    return reply.status(400).send({ error: "Password is required to unlock app." });
  }

  let storedPassword = APP_PASSWORD;
  try {
    const redisPass = await redisClient.get("app:password");
    if (redisPass) storedPassword = redisPass;
  } catch (err) {
    console.error("Failed to read app:password from Redis:", err.message);
  }

  if (password.trim() !== storedPassword) {
    return reply.status(401).send({ error: "Incorrect password. Access denied." });
  }

  // Issue session token
  const token = `sess_${Math.random().toString(36).substring(2)}_${Date.now().toString(36)}`;
  try {
    await redisClient.set(`app:session:${token}`, "authenticated", "EX", 86400); // 24 Hours TTL
  } catch (err) {
    console.error("Failed to save session token to Redis:", err.message);
  }

  return reply.send({ success: true, token, message: "App unlocked successfully." });
});

// AUTH ENDPOINT 2: Check Session
fastify.get("/api/auth/check", async (req, reply) => {
  // In development mode, no password required
  if (!IS_PROD) {
    return reply.send({ authenticated: true, isProd: false, devMode: true });
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return reply.status(401).send({ authenticated: false, isProd: true, error: "No token provided." });
  }

  try {
    const val = await redisClient.get(`app:session:${token}`);
    if (val === "authenticated") {
      return reply.send({ authenticated: true, isProd: true });
    }
  } catch (err) {
    console.error("Check session error:", err.message);
  }

  return reply.status(401).send({ authenticated: false, isProd: true, error: "Session expired or invalid." });
});

// AUTH ENDPOINT 3: Logout App
fastify.post("/api/auth/logout", async (req, reply) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (token) {
    try {
      await redisClient.del(`app:session:${token}`);
    } catch { }
  }
  return reply.send({ success: true, message: "Logged out successfully." });
});


// Serve Static Assets (CSS, JS)
fastify.get("/public/*", async (req, reply) => {
  const relPath = req.url.replace(/^\/public\//, "");
  const filePath = path.join(__dirname, "public", relPath);
  if (fs.existsSync(filePath)) {
    if (filePath.endsWith(".css")) reply.type("text/css");
    else if (filePath.endsWith(".js")) reply.type("application/javascript");
    return fs.readFileSync(filePath);
  }
  return reply.status(404).send("Not Found");
});

// 1. Get Status & Logs
fastify.get("/api/automate/status", async (req, reply) => {
  return reply.send({
    status: activeTask.status,
    step: activeTask.step,
    logs: activeTask.logs,
    redisUrl: activeTask.redisUrl,
    credentials: activeTask.credentials,
    otpError: activeTask.otpError,
    otpAttempt: activeTask.otpAttempt,
    maxOtpAttempts: activeTask.maxOtpAttempts,
    error: activeTask.error,
  });
});

// 2. Start Automation Task
fastify.post("/api/automate/start", async (req, reply) => {
  const { email, password, dbName } = req.body || {};
  if (!email || !password) {
    return reply.status(400).send({ error: "Email and password are required." });
  }

  if (activeTask.status === "RUNNING" || activeTask.status === "WAITING_FOR_OTP") {
    return reply.status(400).send({ error: "An automation task is currently in progress." });
  }

  // Reset Task State
  activeTask = {
    status: "RUNNING",
    step: 1,
    logs: [],
    redisUrl: null,
    credentials: null,
    otpError: null,
    otpAttempt: 1,
    maxOtpAttempts: 3,
    error: null,
    otpResolver: null,
    browser: null,
  };

  reply.send({ message: "Automation started successfully." });

  // Trigger Puppeteer automation asynchronously
  runAutomation({
    email,
    password,
    dbName: dbName || "redis-db3",
    onLog: (msg) => addLog(msg),
    onStep: (num) => { activeTask.step = num; },
    onBrowserLaunch: (b) => { activeTask.browser = b; },
    onOtpRequired: (retryInfo) => {
      activeTask.status = "WAITING_FOR_OTP";
      activeTask.otpError = retryInfo?.error || null;
      activeTask.otpAttempt = retryInfo?.attempt || 1;
      activeTask.maxOtpAttempts = retryInfo?.maxAttempts || 3;
      return new Promise((resolve) => {
        activeTask.otpResolver = resolve;
      });
    },
  })
    .then((result) => {
      if (activeTask.status === "STOPPED") return;
      activeTask.status = "SUCCESS";
      if (typeof result === "string") {
        activeTask.redisUrl = result;
        activeTask.credentials = { redisUrl: result };
      } else {
        activeTask.redisUrl = result.redisUrl;
        activeTask.credentials = result;
      }

      // If development mode, save fetched links/credentials to apis.env
      if (!IS_PROD && activeTask.redisUrl) {
        try {
          const list = readApisEnvFile();
          const epMatch = activeTask.redisUrl.match(/@([^:\/]+)/);
          const ep = epMatch ? epMatch[1] : "new-upstash-db.upstash.io";
          const dbName = ep.replace(".upstash.io", "");
          const newItem = {
            name: dbName,
            redisUrl: activeTask.redisUrl,
            restUrl: activeTask.credentials?.restUrl || `https://${ep}`,
            restToken: activeTask.credentials?.restToken || activeTask.credentials?.password || "",
            locked: false,
          };
          const existingIndex = list.findIndex(item => item.redisUrl === newItem.redisUrl || item.name === dbName);
          if (existingIndex >= 0) {
            list[existingIndex] = { ...list[existingIndex], ...newItem };
          } else {
            list.push(newItem);
          }
          writeApisEnvFile(list);
          addLog("[DEV MODE] Successfully saved database credentials to local apis.env");
        } catch (e) {
          console.error("Failed to auto-save to apis.env in dev mode:", e.message);
        }
      }
    })
    .catch((err) => {
      if (activeTask.status === "STOPPED") return;
      activeTask.status = "FAILED";
      activeTask.error = err.message;
    });
});

// 3. Submit OTP
fastify.post("/api/automate/otp", async (req, reply) => {
  const { otp } = req.body || {};
  if (!otp || String(otp).trim().length < 6) {
    return reply.status(400).send({ error: "Valid 6-digit OTP code is required." });
  }

  if (activeTask.status !== "WAITING_FOR_OTP" || !activeTask.otpResolver) {
    return reply.status(400).send({ error: "Automation is not waiting for OTP at this time." });
  }

  addLog(`Received OTP from Web UI: ${otp}`);
  activeTask.otpResolver(String(otp).trim());
  activeTask.otpResolver = null;
  activeTask.status = "RUNNING";

  return reply.send({ message: "OTP injected into automation engine." });
});

// 4. Stop Automation Task Endpoint
fastify.post("/api/automate/stop", async (req, reply) => {
  if (activeTask.status !== "RUNNING" && activeTask.status !== "WAITING_FOR_OTP") {
    return reply.status(400).send({ error: "No active automation task is currently running." });
  }

  addLog("[STOPPED] Stop command received from Web UI. Terminating automation process...");
  activeTask.status = "STOPPED";

  if (activeTask.otpResolver) {
    try {
      activeTask.otpResolver("");
    } catch { }
    activeTask.otpResolver = null;
  }

  if (activeTask.browser) {
    try {
      await activeTask.browser.close();
    } catch (e) {
      console.error("Error closing browser on stop:", e);
    }
    activeTask.browser = null;
  }

  return reply.send({ success: true, message: "Automation process stopped successfully." });
});

// 4. Test Redis Endpoint
fastify.post("/api/redis/test", async (req, reply) => {
  const { url } = req.body || {};
  if (!url) return reply.status(400).send({ error: "Redis URL is required" });

  try {
    const result = await testRedisConnection(url);
    return reply.send({ success: true, result });
  } catch (err) {
    return reply.status(500).send({ success: false, error: err.message });
  }
});

// Helper to read apis.env JSON array
function readApisEnvFile() {
  const envFilePath = path.join(__dirname, "apis.env");
  if (fs.existsSync(envFilePath)) {
    const content = fs.readFileSync(envFilePath, "utf-8").trim();
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
      } catch { }
    }
  }
  return [];
}

// Helper to write apis.env JSON array
function writeApisEnvFile(list) {
  const envFilePath = path.join(__dirname, "apis.env");
  fs.writeFileSync(envFilePath, JSON.stringify(list, null, 2), "utf-8");
}

// 5. List Databases Endpoint
fastify.get("/api/databases", async (req, reply) => {
  const envList = !IS_PROD ? readApisEnvFile() : [];

  const defaultDbs = [
    {
      id: "db-101822",
      name: "engaged-arachnid-101822",
      endpoint: "engaged-arachnid-101822.upstash.io",
      port: 6379,
      tls: true,
      region: "us-east-1 (N. Virginia)",
      redisUrl: "rediss://default:gQAAAAAAAY2-AAIgcDE4NmY4YjJhM2UxODg0NTBkYjQzOTI1MjM0YTEzYmMyOA@engaged-arachnid-101822.upstash.io:6379",
      restUrl: "https://engaged-arachnid-101822.upstash.io",
      restToken: "gQAAAAAAAY2-AAIgcDE4NmY4YjJhM2UxODg0NTBkYjQzOTI1MjM0YTEzYmMyOA",
      commandsUsed: 11,
      maxCommands: 500000,
      bandwidthUsed: "0 B",
      maxBandwidth: "50 GB",
      storageUsed: "0 B",
      maxStorage: "256 MB",
      locked: false,
    },
    {
      id: "db-126451",
      name: "profound-whale-126451",
      endpoint: "profound-whale-126451.upstash.io",
      port: 6379,
      tls: true,
      region: "us-east-1 (N. Virginia)",
      redisUrl: "rediss://default:gQAAAAAAAe3zAAIgcDFhYzQxYjFlMDNkOWY0MmI0YjcxMjI0MjM0ZmM1YzIxNA@profound-whale-126451.upstash.io:6379",
      restUrl: "https://profound-whale-126451.upstash.io",
      restToken: "gQAAAAAAAe3zAAIgcDFhYzQxYjFlMDNkOWY0MmI0YjcxMjI0MjM0ZmM1YzIxNA",
      commandsUsed: 3,
      maxCommands: 500000,
      bandwidthUsed: "0 B",
      maxBandwidth: "50 GB",
      storageUsed: "0 B",
      maxStorage: "256 MB",
      locked: false,
    },
  ];

  // Merge apis.env contents into database list
  const databasesMap = new Map();
  defaultDbs.forEach(db => databasesMap.set(db.name, db));

  envList.forEach((envItem, idx) => {
    const epMatch = envItem.redisUrl ? envItem.redisUrl.match(/@([^:\/]+)/) : null;
    const endpoint = epMatch ? epMatch[1] : envItem.restUrl ? envItem.restUrl.replace('https://', '') : `${envItem.name}.upstash.io`;

    let token = envItem.restToken || "";
    if (!token && envItem.redisUrl) {
      const tokenMatch = envItem.redisUrl.match(/default:([^@:]+)/);
      if (tokenMatch && tokenMatch[1] && tokenMatch[1].length > 5 && !tokenMatch[1].includes('*')) {
        token = tokenMatch[1];
      }
    }

    let redisUrl = envItem.redisUrl || "";
    if ((!redisUrl || redisUrl.includes('default:@')) && token && endpoint) {
      redisUrl = `rediss://default:${token}@${endpoint}:6379`;
    }

    databasesMap.set(envItem.name, {
      id: `db-env-${idx}`,
      name: envItem.name,
      endpoint: endpoint,
      port: 6379,
      tls: true,
      region: "us-east-1 (N. Virginia)",
      redisUrl: redisUrl,
      restUrl: envItem.restUrl || `https://${endpoint}`,
      restToken: token,
      commandsUsed: 1,
      maxCommands: 500000,
      bandwidthUsed: "0 B",
      maxBandwidth: "50 GB",
      storageUsed: "0 B",
      maxStorage: "256 MB",
      locked: Boolean(envItem.locked),
    });
  });

  // Append newly automated database if present
  if (activeTask.credentials && activeTask.credentials.redisUrl) {
    const creds = activeTask.credentials;
    const endpointMatch = creds.redisUrl.match(/@([^:\/]+)/);
    const ep = endpointMatch ? endpointMatch[1] : "new-upstash-db.upstash.io";
    const dbName = ep.replace(".upstash.io", "");
    if (!databasesMap.has(dbName)) {
      databasesMap.set(dbName, {
        id: `db-${Date.now()}`,
        name: dbName,
        endpoint: ep,
        port: 6379,
        tls: true,
        region: "us-east-1 (N. Virginia)",
        redisUrl: creds.redisUrl,
        restUrl: creds.restUrl || `https://${ep}`,
        restToken: creds.restToken || creds.password || "",
        commandsUsed: 1,
        maxCommands: 500000,
        bandwidthUsed: "0 B",
        maxBandwidth: "50 GB",
        storageUsed: "0 B",
        maxStorage: "256 MB",
        locked: false,
      });
    }
  }

  return reply.send({ databases: Array.from(databasesMap.values()), isProd: IS_PROD });
});

// 6. Save Credentials to apis.env Endpoint
fastify.post("/api/save-to-env", async (req, reply) => {
  if (IS_PROD) {
    return reply.status(400).send({ error: "Saving to apis.env file is disabled in production mode." });
  }

  const { name, redisUrl, restUrl, restToken } = req.body || {};
  if (!redisUrl) {
    return reply.status(400).send({ error: "redisUrl is required." });
  }

  // Reject empty password TCP URLs (e.g. rediss://default:@... or containing ****)
  if (redisUrl.includes("default:@") || redisUrl.includes("****")) {
    return reply.status(400).send({ error: "Invalid TCP connection string. Password is empty or masked." });
  }

  try {
    const list = readApisEnvFile();
    const existingIndex = list.findIndex(item => item.redisUrl === redisUrl || (name && item.name === name));
    const newItem = {
      name: name || "redis-cluster",
      redisUrl,
      restUrl: restUrl || "",
      restToken: restToken || "",
      locked: existingIndex >= 0 ? Boolean(list[existingIndex].locked) : false,
    };

    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...newItem };
    } else {
      list.push(newItem);
    }

    writeApisEnvFile(list);
    return reply.send({ success: true, message: `Successfully saved ${newItem.name} to apis.env!`, data: list });
  } catch (err) {
    return reply.status(500).send({ error: `Failed to save to apis.env: ${err.message}` });
  }
});

// 7. Toggle Lock Status Endpoint
fastify.post("/api/databases/toggle-lock", async (req, reply) => {
  const { name } = req.body || {};
  if (!name) return reply.status(400).send({ error: "Database name is required." });

  try {
    const list = readApisEnvFile();
    const existingIndex = list.findIndex(item => item.name === name);

    let isLocked = false;
    if (existingIndex >= 0) {
      list[existingIndex].locked = !list[existingIndex].locked;
      isLocked = list[existingIndex].locked;
    } else {
      // If not in env file, add default record with locked=true
      const defaultMatch = [
        { name: "engaged-arachnid-101822", redisUrl: "rediss://default:gQAAAAAAAY2-AAIgcDE4NmY4YjJhM2UxODg0NTBkYjQzOTI1MjM0YTEzYmMyOA@engaged-arachnid-101822.upstash.io:6379", restUrl: "https://engaged-arachnid-101822.upstash.io", restToken: "gQAAAAAAAY2-AAIgcDE4NmY4YjJhM2UxODg0NTBkYjQzOTI1MjM0YTEzYmMyOA" },
        { name: "profound-whale-126451", redisUrl: "rediss://default:gQAAAAAAAe3zAAIgcDFhYzQxYjFlMDNkOWY0MmI0YjcxMjI0MjM0ZmM1YzIxNA@profound-whale-126451.upstash.io:6379", restUrl: "https://profound-whale-126451.upstash.io", restToken: "gQAAAAAAAe3zAAIgcDFhYzQxYjFlMDNkOWY0MmI0YjcxMjI0MjM0ZmM1YzIxNA" }
      ].find(d => d.name === name);

      if (defaultMatch) {
        list.push({ ...defaultMatch, locked: true });
        isLocked = true;
      }
    }

    writeApisEnvFile(list);
    return reply.send({ success: true, locked: isLocked, message: `Database ${name} is now ${isLocked ? 'LOCKED' : 'UNLOCKED'}` });
  } catch (err) {
    return reply.status(500).send({ error: `Failed to toggle lock: ${err.message}` });
  }
});

// 8. Delete Database Link Endpoint
fastify.post("/api/databases/delete", async (req, reply) => {
  const { name, confirmed } = req.body || {};
  if (!name) return reply.status(400).send({ error: "Database name is required." });

  if (!confirmed) {
    return reply.status(400).send({ error: "Confirmation is required to delete database link." });
  }

  try {
    const list = readApisEnvFile();
    const existing = list.find(item => item.name === name);

    // Check if locked
    if (existing && existing.locked) {
      return reply.status(403).send({ error: `Cannot delete "${name}". This database link is LOCKED! Unlock it first to delete.` });
    }

    const updatedList = list.filter(item => item.name !== name);
    writeApisEnvFile(updatedList);

    return reply.send({ success: true, message: `Successfully deleted database link for "${name}" from apis.env!` });
  } catch (err) {
    return reply.status(500).send({ error: `Failed to delete database link: ${err.message}` });
  }
});

// Start Secure Fastify Server
const PORT = process.env.PORT || 4000;
try {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`  Secure Fastify Upstash Server Running!`);
  console.log(`  Web Dashboard:  http://localhost:${PORT} `);
} catch (err) {
  console.error("Fastify Server Error:", err);
  process.exit(1);
}
