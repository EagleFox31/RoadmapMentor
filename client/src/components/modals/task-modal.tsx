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
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@shared/schema";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  objectiveId: number;
  task?: Task | null;
  isLoading?: boolean;
}

export function TaskModal({ isOpen, onClose, onSubmit, objectiveId, task, isLoading }: TaskModalProps) {
  const [formData, setFormData] = useState({
    label: "",
    orderIndex: "0",
    isOptional: false,
  });

  useEffect(() => {
    if (task) {
      setFormData({
        label: task.label,
        orderIndex: task.orderIndex.toString(),
        isOptional: task.isOptional,
      });
    } else {
      setFormData({
        label: "",
        orderIndex: "0",
        isOptional: false,
      });
    }
  }, [task, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      objectiveId,
      orderIndex: parseInt(formData.orderIndex),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border-white/20 text-white shadow-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {task ? "Modifier la tâche" : "Nouvelle tâche"}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {task ? "Modifiez les informations de la tâche" : "Créez une nouvelle tâche pour cet objectif"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label" className="text-white text-sm">
              Description de la tâche
            </Label>
            <Input
              id="label"
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              required
              placeholder="Ex: Lire la doc FastAPI (First Steps + Path/Query params)"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-task-label"
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
              data-testid="input-task-order"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isOptional"
              checked={formData.isOptional}
              onCheckedChange={(checked) => setFormData({ ...formData, isOptional: checked as boolean })}
              className="border-white/40"
              data-testid="checkbox-task-optional"
            />
            <Label htmlFor="isOptional" className="text-white text-sm cursor-pointer">
              Tâche optionnelle
            </Label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              data-testid="button-cancel-task"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white"
              data-testid="button-save-task"
            >
              {isLoading ? "Enregistrement..." : task ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
