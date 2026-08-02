import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PORT = process.env.PORT || 4000;
export const HOST = process.env.HOST || "0.0.0.0";
export const NODE_ENV = process.env.NODE_ENV || "development";
export const APIS_ENV_PATH = path.join(__dirname, "../../../apis.env");
export const FRONTEND_DIST_PATH = path.join(__dirname, "../../../../frontend/dist");
