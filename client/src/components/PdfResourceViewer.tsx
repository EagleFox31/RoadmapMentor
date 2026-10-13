import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { safeExternalResourceUrl } from "@shared/resourceLinks";
import { getAuthToken } from "@/lib/auth";

const MAX_PREVIEW_BYTES = 16 * 1024 * 1024;
const MAX_PREVIEW_PAGES = 30;

/** Loaded on first preview only: keeps pdf.js out of the main bundle. */
async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/** Streams the proxied PDF, enforcing the size cap and the %PDF- signature. */
async function fetchPreviewBytes(resourceId: number, signal: AbortSignal): Promise<Uint8Array> {
  const headers: Record<string, string> = { Accept: "application/pdf" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api/resources/${resourceId}/pdf`, { signal, headers });
  if (!response.ok || !response.body) throw new Error("PDF unavailable");
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_PREVIEW_BYTES) throw new Error("PDF too large");

  let size = 0;
  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PREVIEW_BYTES) throw new Error("PDF too large");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (new TextDecoder("latin1").decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("Invalid PDF signature");
  return bytes;
}

/**
 * Opt-in preview. Bytes come from the same-origin proxy (`/api/resources/:id/pdf`)
 * because most document hosts send no CORS headers. Pages are drawn with pdf.js
 * on canvases: the browser's built-in viewer is unreliable inside a modal and
 * absent from mobile iframes. Failures fall back to the original link.
 */
export function PdfResourceViewer({ title, resourceId, url, onClose }: {
  title: string;
  resourceId: number | null;
  /** Original document link, shown as a fallback. */
  url: string | null;
  onClose: () => void;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [pageCount, setPageCount] = useState<{ shown: number; total: number } | null>(null);
  const safe = safeExternalResourceUrl(url);

  useEffect(() => {
    setPageCount(null);
    if (resourceId === null) {
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | null = null;
    setStatus("loading");

    const load = async () => {
      try {
        const bytes = await fetchPreviewBytes(resourceId, controller.signal);
        const pdfjs = await loadPdfjs();
        if (controller.signal.aborted) return;
        task = pdfjs.getDocument({ data: bytes });
        const doc = await task.promise;
        const container = pagesRef.current;
        if (controller.signal.aborted || !container) return;
        container.replaceChildren();

        const shown = Math.min(doc.numPages, MAX_PREVIEW_PAGES);
        const ratio = window.devicePixelRatio || 1;
        for (let number = 1; number <= shown; number++) {
          const page = await doc.getPage(number);
          const width = container.clientWidth > 16 ? container.clientWidth - 16 : 800;
          const viewport = page.getViewport({ scale: (width / page.getViewport({ scale: 1 }).width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "block w-full h-auto bg-white shadow-sm";
          canvas.setAttribute("aria-label", `Page ${number}`);
          container.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
          if (controller.signal.aborted) return;
          if (number === 1) setStatus("ready");
        }
        setPageCount({ shown, total: doc.numPages });
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    };
    void load();
    return () => {
      controller.abort();
      void task?.destroy();
    };
  }, [resourceId]);

  return (
    <Dialog open={resourceId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title || "Document PDF"}</DialogTitle>
          <DialogDescription>
            Aperçu du document. Si l'affichage échoue, ouvrez-le sur son site d'origine.
          </DialogDescription>
        </DialogHeader>
        {status === "loading" && <p role="status" className="text-sm text-muted-foreground">Chargement du PDF…</p>}
        {status === "error" && (
          <p role="status" className="text-sm text-muted-foreground" data-testid="pdf-preview-fallback">
            Aperçu indisponible : utilisez le lien du document original.
          </p>
        )}
        <div
          ref={pagesRef}
          role="document"
          aria-label={`Aperçu PDF : ${title}`}
          data-testid="pdf-preview-pages"
          className={status === "loading" || status === "ready"
            ? "max-h-[65dvh] space-y-3 overflow-y-auto rounded-md border bg-muted/40 p-2"
            : "hidden"}
        />
        {pageCount && pageCount.total > pageCount.shown && (
          <p className="text-xs text-muted-foreground">
            Aperçu limité aux {pageCount.shown} premières pages sur {pageCount.total}.
          </p>
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
