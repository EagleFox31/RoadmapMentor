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
import type { Deliverable } from "@shared/schema";

interface DeliverableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  weekId: number;
  deliverable?: Deliverable | null;
  isLoading?: boolean;
}

export function DeliverableModal({ isOpen, onClose, onSubmit, weekId, deliverable, isLoading }: DeliverableModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    instructions: "",
  });

  useEffect(() => {
    if (deliverable) {
      setFormData({
        title: deliverable.title,
        description: deliverable.description || "",
        instructions: deliverable.instructions || "",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        instructions: "",
      });
    }
  }, [deliverable, isOpen]);

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
            {deliverable ? "Modifier le livrable" : "Nouveau livrable"}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {deliverable ? "Modifiez les informations du livrable" : "Créez un nouveau livrable pour cette semaine"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-white text-sm">
              Titre
            </Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              placeholder="Ex: Repo GitHub avec Docker fonctionnel"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-deliverable-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-white text-sm">
              Description (optionnel)
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description détaillée du livrable..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none min-h-[100px]"
              data-testid="textarea-deliverable-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions" className="text-white text-sm">
              Instructions (optionnel)
            </Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              placeholder="Instructions pour réaliser ce livrable..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none min-h-[100px]"
              data-testid="textarea-deliverable-instructions"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              data-testid="button-cancel-deliverable"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white"
              data-testid="button-save-deliverable"
            >
              {isLoading ? "Enregistrement..." : deliverable ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
