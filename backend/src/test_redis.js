import Redis from "ioredis";

export async function testRedisConnection(redisUrl) {
  if (!redisUrl || typeof redisUrl !== "string") {
    return { success: false, error: "redisUrl is required and must be a string." };
  }

  let redis = null;
  const startTime = Date.now();

  try {
    const isTls = redisUrl.startsWith("rediss://");

    redis = new Redis(redisUrl, {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
    });

    const pingRes = await redis.ping();
    const testKey = `diag:test:${Date.now()}`;
    const testVal = `hello-upstash-${Math.floor(Math.random() * 1000)}`;

    await redis.set(testKey, testVal, "EX", 10);
    const fetchedVal = await redis.get(testKey);
    await redis.del(testKey);

    const elapsed = Date.now() - startTime;

    return {
      success: true,
      result: {
        ping: pingRes,
        latencyMs: elapsed,
        key: testKey,
        val: fetchedVal,
        matched: fetchedVal === testVal,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `IORedis Connection Failed: ${err.message}`,
    };
  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch {
        redis.disconnect();
      }
    }
  }
}
