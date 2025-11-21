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
import type { Week } from "@shared/schema";

interface WeekModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  week?: Week | null;
  isLoading?: boolean;
}

export function WeekModal({ isOpen, onClose, onSubmit, week, isLoading }: WeekModalProps) {
  const [formData, setFormData] = useState({
    number: "",
    title: "",
    startDate: "",
    endDate: "",
    description: "",
  });

  useEffect(() => {
    if (week) {
      setFormData({
        number: week.number.toString(),
        title: week.title,
        startDate: week.startDate,
        endDate: week.endDate,
        description: week.description || "",
      });
    } else {
      setFormData({
        number: "",
        title: "",
        startDate: "",
        endDate: "",
        description: "",
      });
    }
  }, [week, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      number: parseInt(formData.number),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl border-white/20 text-white shadow-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {week ? "Modifier la semaine" : "Nouvelle semaine"}
          </DialogTitle>
          <DialogDescription className="text-white/60">
            {week ? "Modifiez les informations de la semaine" : "Créez une nouvelle semaine dans la feuille de route"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="number" className="text-white text-sm">
              Numéro de semaine
            </Label>
            <Input
              id="number"
              type="number"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              required
              min="1"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-week-number"
            />
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
              placeholder="Ex: Fondations ShopFlow"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              data-testid="input-week-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-white text-sm">
                Date de début
              </Label>
              <Input
                id="startDate"
                type="text"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
                placeholder="24 Nov"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-week-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-white text-sm">
                Date de fin
              </Label>
              <Input
                id="endDate"
                type="text"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                required
                placeholder="30 Nov"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                data-testid="input-week-end-date"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-white text-sm">
              Description (optionnel)
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description de la semaine..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50 resize-none min-h-[100px]"
              data-testid="textarea-week-description"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              data-testid="button-cancel-week"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white"
              data-testid="button-save-week"
            >
              {isLoading ? "Enregistrement..." : week ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
