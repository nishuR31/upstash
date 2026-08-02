import { STATUS_CODES } from "./constants.js";

export function sendSuccess(res, message, statusCode = STATUS_CODES.OK, data = null, details = null) {
  return res.code(statusCode).send({
    success: true,
    message,
    data,
    ...(details && { details }),
  });
}

export function sendError(res, message = "Error occurred", statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR, errors = null) {
  return res.code(statusCode).send({
    success: false,
    message,
    ...(errors && { errors }),
  });
}

export function sendBadRequestError(res, message = "Invalid request", details = null) {
  return sendError(res, message, STATUS_CODES.BAD_REQUEST, details);
}

export function sendNotFoundError(res, message = "Resource not found", details = null) {
  return sendError(res, message, STATUS_CODES.NOT_FOUND, details);
}

export function sendInternalServerError(res, message = "Internal server error", details = null) {
  return sendError(res, message, STATUS_CODES.INTERNAL_SERVER_ERROR, details);
}
