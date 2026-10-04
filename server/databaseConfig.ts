export type DatabaseTransportConfig = {
  wsProxy?: string;
  useSecureWebSocket: boolean;
  pipelineConnect: "password" | false;
  forceDisablePgSSL: boolean;
};

export function resolveDatabaseTransportConfig(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseTransportConfig {
  const wsProxy = env.DATABASE_WS_PROXY?.trim();

  if (!wsProxy) {
    return {
      useSecureWebSocket: true,
      pipelineConnect: "password",
      forceDisablePgSSL: true,
    };
  }

  return {
    wsProxy,
    useSecureWebSocket:
      env.DATABASE_WS_PROXY_INSECURE?.trim().toLowerCase() !== "true",
    pipelineConnect: false,
    forceDisablePgSSL: true,
  };
}
