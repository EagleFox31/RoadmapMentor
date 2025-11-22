import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ScreenshotUploaderProps {
  onUploadComplete: (url: string) => void;
  currentUrl?: string | null;
}

export function ScreenshotUploader({ onUploadComplete, currentUrl }: ScreenshotUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image");
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
      // Get presigned upload URL
      const { uploadURL } = await apiRequest("POST", "/api/objects/upload", {});

      // Upload file to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed");
      }

      // Call completion handler with the upload URL
      onUploadComplete(uploadURL.split("?")[0]);
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
        id="screenshot-upload"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />
      <label htmlFor="screenshot-upload">
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
