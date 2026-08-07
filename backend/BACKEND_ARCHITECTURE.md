# Upstash Backend Microservice Architecture & Directory Structure

This document provides a comprehensive overview of the **Upstash Backend Microservice** architecture (`/home/nishu/TechStack/codes/upstash/backend`).

---

## 🏛️ System Overview

The backend microservice is built with **Fastify**, **Puppeteer**, and **ioredis** under **Bun** / **Node.js**. It automates Upstash account registration, OTP verification, database provisioning, TCP connection string scraping, and diagnostic connection testing.

---

## 📂 Directory & File Structure

```
backend/
├── package.json               # Backend dependencies and execution scripts
├── server.js                  # Alias / optional entry point wrapper
├── test-modal.js              # Standalone test script for modal interactions
├── debug_dom.js               # Utility script to dump DOM / hrefs from Upstash console
├── BACKEND_ARCHITECTURE.md    # Architecture & file specification (this file)
└── src/
    ├── index.js               # Entry point - starts Fastify server & handles graceful shutdown
    ├── app.js                 # Fastify app initialization, CORS, compression, error handlers, & routes
    ├── automator.js           # Core Puppeteer engine for Upstash sign-up, OTP & TCP extraction
    ├── test_redis.js          # ioredis diagnostic client for PING/SET/GET connection verification
    ├── config/
    │   ├── envConfig.js       # Environment variables (PORT, HOST, paths)
    │   └── serverConfig.js    # Fastify server plugins setup (Helmet, Rate-Limit, CORS, Swagger)
    ├── controllers/
    │   ├── automationController.js  # HTTP handlers for /api/v1/automate/* (start, otp, status, stop)
    │   ├── databaseController.js    # HTTP handlers for /api/v1/databases, /save-to-env, /delete
    │   └── diagnosticController.js  # HTTP handler for /api/v1/redis/test
    ├── routes/
    │   ├── apiRoutes.js       # Global router registering /api prefix
    │   └── v1/
    │       └── v1Routes.js    # API v1 endpoint mapping to controllers
    ├── services/
    │   ├── automationService.js # In-memory state machine & orchestration bridge for automator.js
    │   └── databaseService.js   # Local JSON database storage manager (reads/writes apis.env)
    └── utils/
        └── common/
            ├── constants.js   # HTTP Status code definitions and constants
            └── response.js    # Standardized API response formatters (sendSuccess, sendError)
```

---

## 📄 Comprehensive File Reference

### 🔌 Entry Point & App Lifecycle
1. **`src/index.js`**
   - **Purpose**: Server entry point.
   - **Responsibility**: Boots the Fastify server using `PORT` and `HOST` from `envConfig.js`. Configures `SIGINT` / `SIGTERM` graceful shutdown hooks and handles uncaught exceptions.

2. **`src/app.js`**
   - **Purpose**: Fastify application builder.
   - **Responsibility**: Configures Fastify plugins via `serverConfig.js`, sets up global JSON error formatting, and registers API routes under `/api`.

### 🤖 Core Automation & Diagnostics
3. **`src/automator.js`**
   - **Purpose**: Puppeteer automation engine.
   - **Responsibility**: 
     - Spawns headless Chrome browser.
     - Navigates to `https://console.upstash.com/auth/sign-up` and submits account creation forms.
     - Suspends execution and awaits user OTP input via callback (`onOtpRequired`).
     - Safely injects 6-digit OTP code using synthetic React events and Puppeteer keyboard fallback with detached-frame error protection.
     - Navigates to Redis dashboard, handles the 2-step database creation modal (Primary Region selection & plan confirmation).
     - Scrapes unmasked TCP connection string (`rediss://default:TOKEN@host:6379`), REST URL, and REST Token.

4. **`src/test_redis.js`**
   - **Purpose**: Redis TCP Connection Validator.
   - **Responsibility**: Uses `ioredis` to execute `PING`, `SET`, `GET`, and `DEL` operations against any given `REDIS_URL` string and measures round-trip latency.

### ⚙️ Configuration
5. **`src/config/envConfig.js`**
   - **Purpose**: Centralized environment settings.
   - **Responsibility**: Exports `PORT` (default 4000), `HOST` ("0.0.0.0"), `APIS_ENV_PATH`, and static asset directories.

6. **`src/config/serverConfig.js`**
   - **Purpose**: Middleware configuration.
   - **Responsibility**: Registers Fastify plugins including `@fastify/cors` (CORS headers), `@fastify/helmet` (security headers), `@fastify/rate-limit`, and `@fastify/swagger` API docs.

### 🧠 Controllers (Request Handling)
7. **`src/controllers/automationController.js`**
   - **Endpoints**:
     - `POST /api/v1/automate/start`: Initiates background Upstash account creation.
     - `POST /api/v1/automate/otp`: Submits 6-digit OTP code to the active automation instance.
     - `GET /api/v1/automate/status`: Returns current step, status (IDLE, RUNNING, WAITING_FOR_OTP, COMPLETED, FAILED), logs, and credentials.
     - `POST /api/v1/automate/stop`: Aborts the active Puppeteer browser session.

8. **`src/controllers/databaseController.js`**
   - **Endpoints**:
     - `GET /api/v1/databases`: Lists saved database credentials from `apis.env`.
     - `POST /api/v1/save-to-env`: Saves a new database credential to `apis.env`.
     - `POST /api/v1/databases/delete`: Removes a database from `apis.env`.

9. **`src/controllers/diagnosticController.js`**
   - **Endpoint**:
     - `POST /api/v1/redis/test`: Accepts `{ url }` and returns connection test results (ping, latency, read/write match).

### 🛠️ Services & State Management
10. **`src/services/automationService.js`**
    - **Purpose**: Automation state manager.
    - **Responsibility**: Maintains in-memory state of the running Puppeteer job, buffers log messages, manages OTP promise resolvers, and returns formatted status payloads to the frontend.

11. **`src/services/databaseService.js`**
    - **Purpose**: Persistence layer.
    - **Responsibility**: Reads and writes JSON arrays of database credentials to `apis.env`.

### 📦 Utilities
12. **`src/utils/common/constants.js`**
    - Standard HTTP status code definitions (`200 OK`, `400 BAD_REQUEST`, `500 INTERNAL_SERVER_ERROR`).

13. **`src/utils/common/response.js`**
    - Response helper functions (`sendSuccess`, `sendBadRequestError`, `sendInternalServerError`).
