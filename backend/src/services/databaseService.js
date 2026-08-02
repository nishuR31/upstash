import { readApisEnvFile, writeApisEnvFile } from "./automationService.js";

export function getAllDatabases() {
  const envList = readApisEnvFile();
  const databasesMap = new Map();

  envList.forEach((envItem) => {
    const epMatch = envItem.redisUrl ? envItem.redisUrl.match(/@([^:\/]+)/) : null;
    const endpoint = epMatch ? epMatch[1] : envItem.restUrl ? envItem.restUrl.replace('https://', '') : `${envItem.name}.upstash.io`;

    let token = envItem.restToken || "";
    if (!token && envItem.redisUrl) {
      const tokenMatch = envItem.redisUrl.match(/default:([^@:]+)/);
      if (tokenMatch && tokenMatch[1] && tokenMatch[1].length > 15 && !tokenMatch[1].includes('*')) {
        token = tokenMatch[1];
      }
    }

    let redisUrl = envItem.redisUrl || "";
    if ((!redisUrl || redisUrl.includes('default:@')) && token && endpoint) {
      redisUrl = `rediss://default:${token}@${endpoint}:6379`;
    }

    databasesMap.set(envItem.name, {
      id: `db-env-${envItem.name}`,
      name: envItem.name,
      endpoint: endpoint,
      port: 6379,
      restUrl: envItem.restUrl || `https://${endpoint}`,
      restToken: token,
      redisUrl: redisUrl,
      region: "us-east-1 (N. Virginia)",
      status: "ACTIVE",
      readOnly: false,
      locked: !!envItem.locked
    });
  });

  return Array.from(databasesMap.values());
}

export function saveDatabase({ name, redisUrl, restUrl, restToken }) {
  const list = readApisEnvFile();
  const existingIndex = list.findIndex(item => item.redisUrl === redisUrl || (name && item.name === name));
  const newItem = {
    name: name || "redis-cluster",
    redisUrl,
    restUrl: restUrl || "",
    restToken: restToken || "",
  };

  if (existingIndex >= 0) {
    list[existingIndex] = { ...list[existingIndex], ...newItem };
  } else {
    list.push(newItem);
  }

  writeApisEnvFile(list);
  return list;
}

export function deleteDatabase(name) {
  const list = readApisEnvFile();
  const updatedList = list.filter(item => item.name !== name);
  writeApisEnvFile(updatedList);
  return updatedList;
}
