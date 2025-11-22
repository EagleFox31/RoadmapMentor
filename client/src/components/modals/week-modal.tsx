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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import { fr } from "date-fns/locale";
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
    description: "",
  });
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Helper to parse date string like "24 Nov" to Date
  const parseDateString = (dateStr: string): Date | undefined => {
    try {
      const currentYear = new Date().getFullYear();
      const parsed = parse(`${dateStr} ${currentYear}`, "d MMM yyyy", new Date(), { locale: fr });
      return isNaN(parsed.getTime()) ? undefined : parsed;
    } catch {
      return undefined;
    }
  };

  useEffect(() => {
    if (week) {
      setFormData({
        number: week.number.toString(),
        title: week.title,
        description: week.description || "",
      });
      setStartDate(parseDateString(week.startDate));
      setEndDate(parseDateString(week.endDate));
    } else {
      setFormData({
        number: "",
        title: "",
        description: "",
      });
      setStartDate(undefined);
      setEndDate(undefined);
    }
  }, [week, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      return; // Validation: both dates are required
    }
    onSubmit({
      ...formData,
      number: parseInt(formData.number),
      startDate: format(startDate, "d MMM", { locale: fr }),
      endDate: format(endDate, "d MMM", { locale: fr }),
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
              <Label className="text-white text-sm">
                Date de début
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20"
                    data-testid="button-week-start-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "d MMM yyyy", { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                    locale={fr}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    data-testid="calendar-week-start-date"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-white text-sm">
                Date de fin
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal bg-white/10 border-white/20 text-white hover:bg-white/20"
                    data-testid="button-week-end-date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "d MMM yyyy", { locale: fr }) : "Choisir une date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-800" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                    locale={fr}
                    disabled={(date) => {
                      const today = new Date(new Date().setHours(0, 0, 0, 0));
                      if (date < today) return true;
                      if (startDate && date < startDate) return true;
                      return false;
                    }}
                    data-testid="calendar-week-end-date"
                  />
                </PopoverContent>
              </Popover>
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
