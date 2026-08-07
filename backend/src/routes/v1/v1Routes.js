import {
  getStatusHandler,
  startAutomationHandler,
  submitOtpHandler,
  stopAutomationHandler,
  testSelectorHandler,
} from "../../controllers/automationController.js";
import {
  getDatabasesHandler,
  saveToEnvHandler,
  deleteDatabaseHandler,
} from "../../controllers/databaseController.js";
import { testRedisHandler } from "../../controllers/diagnosticController.js";

const v1Router = async (app) => {
  // Automation Endpoints (/api/v1/automate/*)
  app.get("/automate/status", getStatusHandler);
  app.post("/automate/start", startAutomationHandler);
  app.post("/automate/otp", submitOtpHandler);
  app.post("/automate/stop", stopAutomationHandler);
  app.post("/automate/test-selector", testSelectorHandler);

  // Database Hub Endpoints (/api/v1/databases, /api/v1/save-to-env, /api/v1/databases/delete)
  app.get("/databases", getDatabasesHandler);
  app.post("/save-to-env", saveToEnvHandler);
  app.post("/databases/delete", deleteDatabaseHandler);

  // Diagnostic Endpoint (/api/v1/redis/test)
  app.post("/redis/test", testRedisHandler);
};

export default v1Router;
