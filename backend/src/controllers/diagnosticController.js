import { testRedisConnection } from "../test_redis.js";
import { sendSuccess, sendBadRequestError, sendInternalServerError } from "../utils/common/response.js";
import { STATUS_CODES } from "../utils/common/constants.js";

export async function testRedisHandler(req, reply) {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return sendBadRequestError(reply, "Redis connection URL is required.");
  }

  try {
    const res = await testRedisConnection(url);
    if (res.success) {
      return sendSuccess(reply, "Redis connection test passed", STATUS_CODES.OK, res.result);
    } else {
      return sendBadRequestError(reply, res.error || "Connection test failed");
    }
  } catch (err) {
    return sendInternalServerError(reply, `Diagnostic check failed: ${err.message}`);
  }
}
