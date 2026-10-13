// Server-side fetch of a resource PDF for in-app preview.
// Many document hosts send no CORS headers, so the browser cannot read them
// directly. This proxy only fetches URLs already stored on a resource the
// caller may access, and guards against SSRF:
// - HTTPS on the default port, no credentials in the URL;
// - every resolved address (DNS lookup at connect time, so no rebinding window)
//   and every IP literal must be public;
// - redirects are re-validated, bounded in number;
// - size, idle and total timeouts and the %PDF- signature are enforced.
import https from "node:https";
import dns from "node:dns";
import net from "node:net";
import type { IncomingMessage } from "node:http";
import type { Readable } from "node:stream";

export const MAX_PDF_BYTES = 16 * 1024 * 1024;
const IDLE_TIMEOUT_MS = 15_000;
/** Whole fetch, redirects and body included: a slow host cannot hold a request. */
const TOTAL_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

export class PdfProxyError extends Error {}

const blocked = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 127], ["64:ff9b::", 96], ["100::", 64], ["2001:db8::", 32],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(network, prefix, "ipv6");

export function isPublicAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) is judged by its IPv4 part. A ::ffff:0:0/96
  // rule would not work: BlockList also matches plain IPv4 against it.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isPublicAddress(mapped[1]);
  const family = net.isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PdfProxyError("Invalid URL");
  }
  if (url.protocol !== "https:") throw new PdfProxyError("Only HTTPS documents can be previewed");
  if (url.port !== "" && url.port !== "443") throw new PdfProxyError("Non-standard port refused");
  if (url.username || url.password) throw new PdfProxyError("Credentials in URL refused");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicAddress(host)) throw new PdfProxyError("Private address refused");
  return url;
}

type Resolver = (
  hostname: string,
  options: dns.LookupAllOptions,
  callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void,
) => void;

/** `lookup` for https.request: refuses the host if any resolved address is not public. */
export function createSafeLookup(resolve: Resolver = dns.lookup as unknown as Resolver): net.LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname, { family: options.family as number | undefined, all: true }, (err, addresses) => {
      if (err) return callback(err, "", 4);
      const refused = addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address));
      if (refused) {
        return callback(Object.assign(new PdfProxyError("Private address refused"), { code: "EPRIVATE" }), "", 4);
      }
      if (options.all) return callback(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

/** Buffers a PDF body, enforcing the size cap and the %PDF- signature. */
export async function readPdfBody(body: Readable, maxBytes = MAX_PDF_BYTES): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > maxBytes) {
      body.destroy();
      throw new PdfProxyError("PDF too large");
    }
    chunks.push(buffer);
  }
  const pdf = Buffer.concat(chunks, size);
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new PdfProxyError("Invalid PDF signature");
  return pdf;
}

function get(url: URL, lookup: net.LookupFunction, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      lookup,
      timeout: IDLE_TIMEOUT_MS,
      signal,
      headers: { Accept: "application/pdf", "User-Agent": "RoadmapMentor-PdfPreview/1.0" },
    }, resolve);
    request.on("timeout", () => request.destroy(new PdfProxyError("Upstream timeout")));
    request.on("error", reject);
  });
}

export async function fetchRemotePdf(rawUrl: string, lookup: net.LookupFunction = createSafeLookup()): Promise<Buffer> {
  let url = assertFetchableUrl(rawUrl);
  const signal = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  for (let hop = 0; ; hop++) {
    const response = await get(url, lookup, signal);
    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume();
      if (hop >= MAX_REDIRECTS) throw new PdfProxyError("Too many redirects");
      url = assertFetchableUrl(new URL(response.headers.location, url).toString());
      continue;
    }
    if (status !== 200) {
      response.resume();
      throw new PdfProxyError(`Upstream answered ${status}`);
    }
    const length = Number(response.headers["content-length"]);
    if (Number.isFinite(length) && length > MAX_PDF_BYTES) {
      response.destroy();
      throw new PdfProxyError("PDF too large");
    }
    return readPdfBody(response);
  }
}
