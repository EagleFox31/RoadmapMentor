import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Resource } from "@shared/schema";

interface ResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  weekId: number;
  resource?: Resource | null;
  isLoading?: boolean;
}

export function ResourceModal({ isOpen, onClose, onSubmit, weekId, resource, isLoading }: ResourceModalProps) {
  const [formData, setFormData] = useState({
    label: "",
    url: "",
    resourceType: "DOC" as "DOC" | "VIDEO" | "COURSE" | "ARTICLE" | "OTHER",
  });

  useEffect(() => {
    if (resource) {
      setFormData({
        label: resource.label,
        url: resource.url,
        resourceType: resource.resourceType as any,
      });
    } else {
      setFormData({
        label: "",
        url: "",
        resourceType: "DOC",
      });
    }
  }, [resource, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      weekId,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border-white/20 text-white shadow-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {resource ? "Modifier la ressource" : "Nouvelle ressource"}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {resource ? "Modifiez les informations de la ressource" : "Créez une nouvelle ressource pour cette semaine"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resourceType" className="text-white text-sm">
              Type de ressource
            </Label>
            <Select value={formData.resourceType} onValueChange={(value: any) => setFormData({ ...formData, resourceType: value })}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white" data-testid="select-resource-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/20 text-white">
                <SelectItem value="DOC">Documentation</SelectItem>
                <SelectItem value="VIDEO">Vidéo</SelectItem>
                <SelectItem value="COURSE">Cours</SelectItem>
                <SelectItem value="ARTICLE">Article</SelectItem>
                <SelectItem value="OTHER">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label" className="text-white text-sm">
              Nom de la ressource
            </Label>
            <Input
              id="label"
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              required
              placeholder="Ex: FastAPI Tutorial - First Steps"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-resource-label"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url" className="text-white text-sm">
              URL
            </Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              required
              placeholder="https://fastapi.tiangolo.com/..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-resource-url"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              data-testid="button-cancel-resource"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white"
              data-testid="button-save-resource"
            >
              {isLoading ? "Enregistrement..." : resource ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
