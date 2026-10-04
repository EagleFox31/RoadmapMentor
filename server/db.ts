// From javascript_database blueprint - using DatabaseStorage
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";
import { resolveDatabaseTransportConfig } from "./databaseConfig";

neonConfig.webSocketConstructor = ws;

const transport = resolveDatabaseTransportConfig();
if (transport.wsProxy) {
  neonConfig.wsProxy = transport.wsProxy;
  neonConfig.useSecureWebSocket = transport.useSecureWebSocket;
  neonConfig.pipelineConnect = transport.pipelineConnect;
  neonConfig.forceDisablePgSSL = transport.forceDisablePgSSL;
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
