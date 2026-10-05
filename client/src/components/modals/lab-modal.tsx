import { useEffect, useState, type FormEvent } from "react";
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
import type { Lab } from "@shared/schema";

type LabFormData = {
  title: string;
  description: string | null;
  instructions: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  estimatedMinutes: number;
  starterCode: string | null;
  testCode: string | null;
  repositoryUrl: string | null;
  launchUrl: string | null;
  orderIndex: number;
  isPublished: boolean;
};

interface LabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LabFormData & { weekId: number }) => void;
  weekId: number;
  lab?: Lab | null;
  isLoading?: boolean;
}

const emptyLab: LabFormData = {
  title: "",
  description: null,
  instructions: "",
  difficulty: "BEGINNER",
  estimatedMinutes: 30,
  starterCode: "",
  testCode: "",
  repositoryUrl: null,
  launchUrl: null,
  orderIndex: 0,
  isPublished: false,
};

export function LabModal({ isOpen, onClose, onSubmit, weekId, lab, isLoading }: LabModalProps) {
  const [formData, setFormData] = useState<LabFormData>(emptyLab);

  useEffect(() => {
    setFormData(lab ? {
      title: lab.title,
      description: lab.description,
      instructions: lab.instructions,
      difficulty: lab.difficulty,
      estimatedMinutes: lab.estimatedMinutes,
      starterCode: lab.starterCode,
      testCode: lab.testCode,
      repositoryUrl: lab.repositoryUrl,
      launchUrl: lab.launchUrl,
      orderIndex: lab.orderIndex,
      isPublished: lab.isPublished,
    } : emptyLab);
  }, [lab, isOpen]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...formData,
      description: formData.description || null,
      starterCode: formData.starterCode || null,
      testCode: formData.testCode || null,
      repositoryUrl: formData.repositoryUrl || null,
      launchUrl: formData.launchUrl || null,
      weekId,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lab ? "Modifier le lab" : "Nouveau lab"}</DialogTitle>
          <DialogDescription>
            Créez un exercice court pour appliquer une notion immédiatement, puis publiez-le quand il est prêt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lab-title">Titre</Label>
              <Input id="lab-title" required value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lab-description">Objectif andragogique</Label>
              <Textarea id="lab-description" value={formData.description ?? ""} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Ce que l'apprenant saura faire après ce lab" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lab-instructions">Consignes</Label>
              <Textarea id="lab-instructions" required className="min-h-32" value={formData.instructions} onChange={(event) => setFormData({ ...formData, instructions: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Difficulté</Label>
              <Select value={formData.difficulty} onValueChange={(difficulty: LabFormData["difficulty"]) => setFormData({ ...formData, difficulty })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BEGINNER">Débutant</SelectItem>
                  <SelectItem value="INTERMEDIATE">Intermédiaire</SelectItem>
                  <SelectItem value="ADVANCED">Avancé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lab-duration">Durée estimée (minutes)</Label>
              <Input id="lab-duration" type="number" min={5} max={240} required value={formData.estimatedMinutes} onChange={(event) => setFormData({ ...formData, estimatedMinutes: Number(event.target.value) })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lab-starter">Code Python de départ</Label>
              <Textarea id="lab-starter" className="min-h-36 font-mono" spellCheck={false} value={formData.starterCode ?? ""} onChange={(event) => setFormData({ ...formData, starterCode: event.target.value })} placeholder={'def solution():\n    pass'} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lab-tests">Tests Python</Label>
              <Textarea id="lab-tests" className="min-h-28 font-mono" spellCheck={false} value={formData.testCode ?? ""} onChange={(event) => setFormData({ ...formData, testCode: event.target.value })} placeholder={'assert solution() == 42\nprint("Tests réussis")'} />
              <p className="text-xs text-muted-foreground">Les tests sont ajoutés au code de l’apprenant lors de l’exécution.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lab-repository">Dépôt de départ (optionnel)</Label>
              <Input id="lab-repository" type="url" value={formData.repositoryUrl ?? ""} onChange={(event) => setFormData({ ...formData, repositoryUrl: event.target.value })} placeholder="https://github.com/..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lab-launch">Environnement externe (optionnel)</Label>
              <Input id="lab-launch" type="url" value={formData.launchUrl ?? ""} onChange={(event) => setFormData({ ...formData, launchUrl: event.target.value })} placeholder="https://..." />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-lg border p-3">
            <input type="checkbox" checked={formData.isPublished} onChange={(event) => setFormData({ ...formData, isPublished: event.target.checked })} />
            <span className="text-sm">Publier ce lab pour les apprenants</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isLoading}>{isLoading ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
