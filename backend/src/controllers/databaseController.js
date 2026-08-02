import { getAllDatabases, saveDatabase, deleteDatabase } from "../services/databaseService.js";
import { sendSuccess, sendBadRequestError, sendInternalServerError } from "../utils/common/response.js";
import { STATUS_CODES } from "../utils/common/constants.js";
import { NODE_ENV } from "../config/envConfig.js";

export async function getDatabasesHandler(req, reply) {
  try {
    const dbs = getAllDatabases();
    return sendSuccess(reply, "Databases fetched successfully", STATUS_CODES.OK, dbs);
  } catch (err) {
    return sendInternalServerError(reply, `Failed to fetch database list: ${err.message}`);
  }
}

export async function saveToEnvHandler(req, reply) {
  if (NODE_ENV === "production") {
    return sendBadRequestError(reply, "Direct storage modifications disabled in production mode.");
  }

  const { name, redisUrl, restUrl, restToken } = req.body || {};
  if (!redisUrl) {
    return sendBadRequestError(reply, "redisUrl parameter is required.");
  }

  if (
    redisUrl.includes("default:@") ||
    redisUrl.includes("****") ||
    redisUrl.includes("default:required") ||
    !restToken ||
    restToken === "required" ||
    restToken.length < 15
  ) {
    return sendBadRequestError(reply, "Invalid TCP connection string or REST Token.");
  }

  try {
    const list = saveDatabase({ name, redisUrl, restUrl, restToken });
    return sendSuccess(reply, `Successfully saved database credentials!`, STATUS_CODES.OK, list);
  } catch (err) {
    return sendInternalServerError(reply, `Failed to save credentials: ${err.message}`);
  }
}

export async function deleteDatabaseHandler(req, reply) {
  const { name } = req.body || {};
  if (!name) return sendBadRequestError(reply, "Database name parameter is required.");

  try {
    deleteDatabase(name);
    return sendSuccess(reply, `Successfully removed database link "${name}".`, STATUS_CODES.OK, null);
  } catch (err) {
    return sendInternalServerError(reply, `Failed to delete database link: ${err.message}`);
  }
}
