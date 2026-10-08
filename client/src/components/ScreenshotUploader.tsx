import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/auth";

interface ScreenshotUploaderProps {
  onUploadComplete: (url: string) => void;
  currentUrl?: string | null;
  taskId: number;
}

export function ScreenshotUploader({ onUploadComplete, currentUrl, taskId }: ScreenshotUploaderProps) {
  // Several task uploaders can coexist: a shared HTML id always targets the
  // first file input, so each component needs a stable unique identifier.
  const inputId = useId();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setError("Formats acceptés : PNG, JPEG, WebP ou GIF");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("L'image ne doit pas dépasser 5MB");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Get a provider-specific upload target. The application does not need
      // to know whether storage is Replit-backed or local/filesystem-backed.
      const { uploadURL, objectPath, requiresAuth, uploadTicket } = await apiRequest(
        "POST",
        "/api/objects/upload",
        {},
      );

      const headers: Record<string, string> = {
        "Content-Type": file.type,
      };
      if (uploadTicket) {
        headers["X-Upload-Ticket"] = uploadTicket;
      }
      if (requiresAuth) {
        const token = getAuthToken();
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
      }

      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      // Persist the canonical application path, not a provider URL.
      onUploadComplete(objectPath || uploadURL.split("?")[0]);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        id={inputId}
        data-testid={`input-upload-screenshot-${taskId}`}
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />
      <label htmlFor={inputId}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUploading}
          className="cursor-pointer"
          data-testid="button-upload-screenshot"
          asChild
        >
          <span>
            {isUploading ? (
              <>
                <Upload className="w-4 h-4 mr-2 animate-spin" />
                Upload en cours...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {currentUrl ? "Remplacer" : "Joindre"} capture
              </>
            )}
          </span>
        </Button>
      </label>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}
