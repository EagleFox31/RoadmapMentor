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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Objective } from "@shared/schema";

interface ObjectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  weekId: number;
  objective?: Objective | null;
  isLoading?: boolean;
}

export function ObjectiveModal({ isOpen, onClose, onSubmit, weekId, objective, isLoading }: ObjectiveModalProps) {
  const [formData, setFormData] = useState({
    type: "CONCEPT" as "CONCEPT" | "ALGO" | "PROJECT" | "OTHER",
    title: "",
    description: "",
    orderIndex: "0",
  });

  useEffect(() => {
    if (objective) {
      setFormData({
        type: objective.type as any,
        title: objective.title,
        description: objective.description || "",
        orderIndex: objective.orderIndex.toString(),
      });
    } else {
      setFormData({
        type: "CONCEPT",
        title: "",
        description: "",
        orderIndex: "0",
      });
    }
  }, [objective, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      weekId,
      orderIndex: parseInt(formData.orderIndex),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border-white/20 text-white shadow-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {objective ? "Modifier l'objectif" : "Nouvel objectif"}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {objective ? "Modifiez les informations de l'objectif" : "Créez un nouvel objectif pour cette semaine"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type" className="text-white text-sm">
              Type d'objectif
            </Label>
            <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
              <SelectTrigger className="bg-white/10 border-white/20 text-white" data-testid="select-objective-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/20 text-white">
                <SelectItem value="CONCEPT">Concept à Maîtriser</SelectItem>
                <SelectItem value="ALGO">Exercices Algo</SelectItem>
                <SelectItem value="PROJECT">Projet</SelectItem>
                <SelectItem value="OTHER">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              placeholder="Ex: FastAPI Basics + Pydantic"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-objective-title"
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
              placeholder="Description de l'objectif..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none min-h-[80px]"
              data-testid="textarea-objective-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="orderIndex" className="text-white text-sm">
              Ordre d'affichage
            </Label>
            <Input
              id="orderIndex"
              type="number"
              value={formData.orderIndex}
              onChange={(e) => setFormData({ ...formData, orderIndex: e.target.value })}
              min="0"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-objective-order"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              data-testid="button-cancel-objective"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white"
              data-testid="button-save-objective"
            >
              {isLoading ? "Enregistrement..." : objective ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
