import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { LookupAddress } from "node:dns";
import {
  assertFetchableUrl,
  createSafeLookup,
  fetchRemotePdf,
  isPublicAddress,
  PdfProxyError,
  readPdfBody,
} from "../server/services/pdfProxy";

test("isPublicAddress refuses loopback, private, link-local and metadata ranges", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "not-an-ip"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  for (const address of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("assertFetchableUrl only accepts credential-free HTTPS on the default port", () => {
  assert.equal(assertFetchableUrl("https://docs.example.org/a.pdf").hostname, "docs.example.org");
  assert.ok(assertFetchableUrl("https://docs.example.org:443/a.pdf"));
  for (const url of [
    "http://docs.example.org/a.pdf",
    "https://docs.example.org:8443/a.pdf",
    "https://user:pw@docs.example.org/a.pdf",
    "https://127.0.0.1/a.pdf",
    "https://[::1]/a.pdf",
    "https://[::ffff:127.0.0.1]/a.pdf",
    "https://169.254.169.254/latest.pdf",
    "file:///etc/passwd",
    "not a url",
  ]) {
    assert.throws(() => assertFetchableUrl(url), PdfProxyError, url);
  }
});

function lookupWith(addresses: LookupAddress[]) {
  return createSafeLookup((_host, _options, callback) => callback(null, addresses));
}

function runLookup(lookup: ReturnType<typeof createSafeLookup>, all: boolean) {
  return new Promise<{ err: unknown; address: unknown }>((resolve) => {
    lookup("docs.example.org", { all }, (err, address) => resolve({ err, address }));
  });
}

test("safe lookup refuses a host if any resolved address is private (DNS rebinding)", async () => {
  const mixed = await runLookup(lookupWith([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }]), false);
  assert.ok(mixed.err instanceof PdfProxyError);

  const single = await runLookup(lookupWith([{ address: "93.184.216.34", family: 4 }]), false);
  assert.equal(single.err, null);
  assert.equal(single.address, "93.184.216.34");

  const all = await runLookup(lookupWith([{ address: "93.184.216.34", family: 4 }]), true);
  assert.deepEqual(all.address, [{ address: "93.184.216.34", family: 4 }]);
});

test("readPdfBody enforces the PDF signature and the size cap", async () => {
  const pdf = await readPdfBody(Readable.from([Buffer.from("%PDF-1.4\n"), Buffer.from("%%EOF")]));
  assert.equal(pdf.toString("latin1"), "%PDF-1.4\n%%EOF");
  await assert.rejects(readPdfBody(Readable.from([Buffer.from("<html>")])), PdfProxyError);
  await assert.rejects(readPdfBody(Readable.from([Buffer.from("%PDF-"), Buffer.alloc(20)]), 10), PdfProxyError);
});

test("fetchRemotePdf never connects to a host resolving to a private address", async () => {
  await assert.rejects(
    fetchRemotePdf("https://docs.example.org/a.pdf", lookupWith([{ address: "127.0.0.1", family: 4 }])),
    PdfProxyError,
  );
});
