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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
    problemToSolve: "",
    practicePrompt: "",
    estimatedMinutes: "",
    isRequired: false,
    orderIndex: "0",
  });

  useEffect(() => {
    if (resource) {
      setFormData({
        label: resource.label,
        url: resource.url,
        resourceType: resource.resourceType as any,
        problemToSolve: resource.problemToSolve ?? "",
        practicePrompt: resource.practicePrompt ?? "",
        estimatedMinutes: resource.estimatedMinutes?.toString() ?? "",
        isRequired: resource.isRequired,
        orderIndex: resource.orderIndex.toString(),
      });
    } else {
      setFormData({
        label: "",
        url: "",
        resourceType: "DOC",
        problemToSolve: "",
        practicePrompt: "",
        estimatedMinutes: "",
        isRequired: false,
        orderIndex: "0",
      });
    }
  }, [resource, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      label: formData.label.trim(),
      url: formData.url.trim(),
      problemToSolve: formData.problemToSolve.trim() || null,
      practicePrompt: formData.practicePrompt.trim() || null,
      estimatedMinutes: formData.estimatedMinutes ? Number(formData.estimatedMinutes) : null,
      orderIndex: Number(formData.orderIndex || "0"),
      weekId,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-neutral-900/95 to-neutral-800/95 backdrop-blur-xl border-white/20 text-white shadow-2xl max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {resource ? "Modifier la ressource" : "Nouvelle ressource"}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Reliez la ressource à un problème réel et à une expérimentation autonome.
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
              <SelectContent className="bg-neutral-900 border-white/20 text-white">
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

            <div className="space-y-2">
            <Label htmlFor="resource-problem" className="text-white text-sm">
              Quel problème concret cette ressource aide-t-elle à résoudre ?
            </Label>
            <Textarea id="resource-problem" value={formData.problemToSolve} maxLength={1200}
              onChange={(e) => setFormData({ ...formData, problemToSolve: e.target.value })}
              placeholder="Ex. Une modification casse le projet : comment retrouver une version stable ?"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-resource-problem" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-practice" className="text-white text-sm">
              Que doit essayer l'apprenant ensuite, en autonomie ?
            </Label>
            <Textarea id="resource-practice" value={formData.practicePrompt} maxLength={1200}
              onChange={(e) => setFormData({ ...formData, practicePrompt: e.target.value })}
              placeholder="Ex. Créer une branche, provoquer un bug, diagnostiquer et corriger."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-resource-practice" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="resource-duration" className="text-white text-sm">Temps indicatif (min)</Label>
              <Input id="resource-duration" type="number" min={1} max={480} step={1}
                value={formData.estimatedMinutes}
                onChange={(e) => setFormData({ ...formData, estimatedMinutes: e.target.value })}
                className="bg-white/10 border-white/20 text-white" data-testid="input-resource-duration" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resource-order" className="text-white text-sm">Ordre dans la semaine</Label>
              <Input id="resource-order" type="number" min={0} max={10000} step={1}
                value={formData.orderIndex}
                onChange={(e) => setFormData({ ...formData, orderIndex: e.target.value })}
                className="bg-white/10 border-white/20 text-white" data-testid="input-resource-order" />
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-white/20 p-3">
            <Checkbox id="resource-required" checked={formData.isRequired}
              onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked === true })}
              data-testid="checkbox-resource-required" />
            <div>
              <Label htmlFor="resource-required" className="text-white text-sm cursor-pointer">Ressource essentielle</Label>
              <p className="text-xs text-white/70">
                Indication du mentor. Regarder la ressource ne valide pas automatiquement une compétence.
              </p>
            </div>
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
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
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
