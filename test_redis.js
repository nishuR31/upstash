import Redis from "ioredis";

const REDIS_URLS = [
  {
    name: "engaged-arachnid-101822",
    url: "rediss://default:gQAAAAAAAY2-AAIgcDE4NmY4YjJhM2UxODg0NTBkYjQzOTI1MjM0YTEzYmMyOA@engaged-arachnid-101822.upstash.io:6379",
  },
  {
    name: "profound-whale-126451",
    url: "rediss://default:gQAAAAAAAe3zAAIgcDFhYzQxYjFlMDNkOWY0MmI0YjcxMjI0MjM0ZmM1YzIxNA@profound-whale-126451.upstash.io:6379",
  },
];

export async function testRedisConnection(connectionUrl) {
  const redis = new Redis(connectionUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    tls: { rejectUnauthorized: false },
  });

  try {
    const startMs = Date.now();
    const pingResult = await redis.ping();
    const latency = Date.now() - startMs;

    const testKey = "snip:test:status";
    await redis.set(testKey, `Verified at ${new Date().toISOString()}`, "EX", 30);
    const val = await redis.get(testKey);
    await redis.del(testKey);

    return {
      status: "ONLINE",
      ping: pingResult,
      latencyMs: latency,
      val,
    };
  } finally {
    await redis.quit();
  }
}

async function main() {
  console.log("=========================================");
  console.log("    Upstash Redis Cluster Diagnostics    ");
  console.log("=========================================");

  for (const item of REDIS_URLS) {
    console.log(`\nTesting ${item.name}...`);
    try {
      const res = await testRedisConnection(item.url);
      console.log(`✓ Status: ${res.status}`);
      console.log(`✓ PING:   ${res.ping} (${res.latencyMs}ms latency)`);
    } catch (err) {
      console.error(`❌ Failed: ${err.message}`);
    }
  }

  console.log("\n=========================================\n");
}

if (process.argv[1] && process.argv[1].endsWith("test_redis.js")) {
  main();
}
