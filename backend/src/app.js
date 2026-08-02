import fastifyApp from "./config/serverConfig.js";
import apiRouter from "./routes/apiRoutes.js";
import { sendError } from "./utils/common/response.js";
import { STATUS_CODES } from "./utils/common/constants.js";
import { NODE_ENV } from "./config/envConfig.js";

const app = fastifyApp;

// Register API Routes under /api prefix
app.register(apiRouter, { prefix: "/api" });

// 404 Handler
app.setNotFoundHandler((_req, res) => {
  return sendError(res, "Route not found", STATUS_CODES.NOT_FOUND);
});

// Global Error Handler
app.setErrorHandler((err, _req, res) => {
  const statusCode = err?.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
  return sendError(res, err?.message || "Something went wrong", statusCode, {
    name: err?.name,
    details: err?.details || {},
    ...(NODE_ENV === "development" ? { stack: err?.stack } : {}),
  });
});

export default app;
