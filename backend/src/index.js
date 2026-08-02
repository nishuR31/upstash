import app from "./app.js";
import { PORT, HOST } from "./config/envConfig.js";

const startServer = async () => {
  try {
    const address = await app.listen({ port: PORT, host: HOST });
    console.log(`\n  ======================================================`);
    console.log(`  FASTIFY BACKEND MICROSERVICE ACTIVE (authService Pattern)`);
    console.log(`  API Server Running at: ${address}`);
    console.log(`  ======================================================\n`);
  } catch (err) {
    console.error("Fastify Server Error:", err?.message || err);
    process.exit(1);
  }
};

startServer();

async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  app.close(() => {
    console.log("HTTP server closed cleanly.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Shutdown timed out. Forcing exit.");
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason?.message || reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error.message, error.stack);
  process.exit(1);
});
