import fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fastifyStatic from "@fastify/static";
import fs from "fs";
import { FRONTEND_DIST_PATH } from "./envConfig.js";

const APP_VERSION = "1.0.0";
const APP_NAME = "upstash-backend-service";

let fastifyApp = fastify({
  logger: true,
  trustProxy: true,
  bodyLimit: 1048576,
});

await fastifyApp.register(cors, { origin: true, credentials: true });
await fastifyApp.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

await fastifyApp.register(compress, { encodings: ["gzip", "deflate", "br"] });
await fastifyApp.register(rateLimit, { max: 100, timeWindow: "1 minute" });

await fastifyApp.register(swagger, {
  openapi: {
    info: {
      title: "Upstash Redis Cloud Console API",
      description: "Automated Upstash Redis Provisioning & Health Diagnostic Microservice",
      version: APP_VERSION,
    },
    servers: [{ url: "http://localhost:4000", description: "Local Service" }],
  },
});

await fastifyApp.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: { deepLinking: true },
  staticCSP: false,
});

// Root System Routes
fastifyApp.get("/", async (req, reply) => {
  return reply.status(200).send({
    message: "Upstash Cloud Console Backend Microservice",
    version: APP_VERSION,
    service: APP_NAME,
    docs: "/docs",
    api: "/api/v1",
    timestamp: new Date().toISOString(),
  });
});

fastifyApp.get("/ping", async (req, reply) => {
  return reply.status(200).send({
    success: true,
    message: "pong",
    timestamp: new Date().toISOString(),
  });
});

fastifyApp.get("/health", async (req, reply) => {
  return reply.status(200).send({
    status: "UP",
    service: APP_NAME,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

fastifyApp.get("/version", async (req, reply) => {
  return reply.status(200).send({
    version: APP_VERSION,
    name: APP_NAME,
  });
});

// Serve frontend dist static files if present (e.g. assets)
if (fs.existsSync(FRONTEND_DIST_PATH)) {
  await fastifyApp.register(fastifyStatic, {
    root: FRONTEND_DIST_PATH,
    prefix: "/app/",
    wildcard: true,
  });
}

export default fastifyApp;
