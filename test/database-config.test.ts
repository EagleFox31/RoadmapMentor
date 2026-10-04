import test from "node:test";
import assert from "node:assert/strict";
import { resolveDatabaseTransportConfig } from "../server/databaseConfig";

test("Neon/default transport keeps secure WebSockets and password pipelining", () => {
  assert.deepEqual(resolveDatabaseTransportConfig({}), {
    useSecureWebSocket: true,
    pipelineConnect: "password",
    forceDisablePgSSL: true,
  });
});

test("self-hosted PostgreSQL proxy disables connection pipelining", () => {
  assert.deepEqual(
    resolveDatabaseTransportConfig({
      DATABASE_WS_PROXY: "db-proxy:80/v1",
      DATABASE_WS_PROXY_INSECURE: "true",
    }),
    {
      wsProxy: "db-proxy:80/v1",
      useSecureWebSocket: false,
      pipelineConnect: false,
      forceDisablePgSSL: true,
    },
  );
});

test("a remote self-hosted proxy remains secure by default", () => {
  const config = resolveDatabaseTransportConfig({
    DATABASE_WS_PROXY: "postgres-proxy.example.com/v1",
  });

  assert.equal(config.useSecureWebSocket, true);
  assert.equal(config.pipelineConnect, false);
});
