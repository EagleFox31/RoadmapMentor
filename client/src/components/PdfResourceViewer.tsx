import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { safeExternalResourceUrl } from "@shared/resourceLinks";

const MAX_PREVIEW_BYTES = 16 * 1024 * 1024;

/**
 * Browser-side, opt-in preview. No server-side URL fetch/SSRF surface.
 * External CORS or PDF browser restrictions gracefully fall back to the link.
 */
export function PdfResourceViewer({ title, url, onClose }: {
  title: string;
  url: string | null;
  onClose: () => void;
}) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const safe = safeExternalResourceUrl(url);

  useEffect(() => {
    if (!url) {
      setPdfBlobUrl(null);
      setError(false);
      return;
    }
    const controller = new AbortController();
    let blobUrl: string | null = null;
    setPdfBlobUrl(null);
    setError(false);
    setLoading(true);

    const load = async () => {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: "application/pdf" },
        });
        if (!response.ok || !response.body) throw new Error("PDF unavailable");
        const length = Number(response.headers.get("content-length"));
        if (Number.isFinite(length) && length > MAX_PREVIEW_BYTES) throw new Error("PDF too large");

        let size = 0;
        const prefix: number[] = [];
        const chunks: ArrayBuffer[] = [];
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > MAX_PREVIEW_BYTES) throw new Error("PDF too large");
            for (const octet of value) {
              if (prefix.length === 5) break;
              prefix.push(octet);
            }
            const copy = new Uint8Array(value.byteLength);
            copy.set(value);
            chunks.push(copy.buffer);
          }
        } finally {
          reader.releaseLock();
        }
        if (String.fromCharCode(...prefix) !== "%PDF-") throw new Error("Invalid PDF signature");
        if (controller.signal.aborted) return;
        blobUrl = URL.createObjectURL(new Blob(chunks, { type: "application/pdf" }));
        setPdfBlobUrl(blobUrl);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => {
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  return (
    <Dialog open={url !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title || "Document PDF"}</DialogTitle>
          <DialogDescription>
            L'aperçu reste facultatif. Certains fournisseurs bloquent l'accès CORS aux documents.
          </DialogDescription>
        </DialogHeader>
        {loading && <p role="status" className="text-sm text-muted-foreground">Chargement du PDF…</p>}
        {error && (
          <p role="status" className="text-sm text-muted-foreground" data-testid="pdf-preview-fallback">
            Aperçu indisponible : utilisez le lien du document original.
          </p>
        )}
        {pdfBlobUrl && (
          <iframe
            src={pdfBlobUrl}
            title={`Aperçu PDF : ${title}`}
            className="h-[65vh] w-full rounded-md border"
            sandbox="allow-downloads allow-scripts"
            data-testid="iframe-resource-pdf"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {safe && (
            <a href={safe} target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary underline" data-testid="link-resource-pdf-original">
              Ouvrir le PDF sur son site d'origine
            </a>
          )}
          <Button variant="outline" type="button" onClick={onClose} data-testid="button-close-pdf-preview">
            Fermer l'aperçu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
