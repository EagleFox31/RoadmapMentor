// Test-only: the API never reveals an invitation token, so the integration suite
// installs a known token (its sha256) on a row, optionally forcing its expiry.
// Usage: tsx set-invitation-token.ts --id=<n> --token=<t> [--expired]
import { eq } from "drizzle-orm";
import { db, pool } from "../../../server/db";
import { invitations } from "@shared/schema";
import { hashInvitationToken } from "../../../server/services/invitationTokens";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const id = Number(readArg("id"));
  const token = readArg("token");
  if (!Number.isInteger(id) || !token) throw new Error("--id and --token are required");
  const expired = process.argv.includes("--expired");
  await db
    .update(invitations)
    .set({
      tokenHash: hashInvitationToken(token),
      ...(expired ? { expiresAt: new Date(Date.now() - 60_000) } : {}),
    })
    .where(eq(invitations.id, id));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
