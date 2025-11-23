import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, CheckCircle2, Edit2, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface GeneratedWeek {
  weekNumber: number;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
  objectives: {
    type: "CONCEPT" | "ALGO" | "PROJECT" | "OTHER";
    title: string;
    description: string;
    tasks: {
      label: string;
      isOptional: boolean;
    }[];
  }[];
  deliverables: {
    title: string;
    description: string;
    instructions: string;
  }[];
  resources: {
    label: string;
    url: string;
    resourceType: "DOC" | "VIDEO" | "COURSE" | "ARTICLE" | "OTHER";
  }[];
}

interface AIRoadmapModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (weeks: GeneratedWeek[]) => Promise<void>;
}

export function AIRoadmapModal({ open, onClose, onSave }: AIRoadmapModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "preview">("form");
  const [generatedWeeks, setGeneratedWeeks] = useState<GeneratedWeek[]>([]);

  // Form state
  const [topic, setTopic] = useState("");
  const [numberOfWeeks, setNumberOfWeeks] = useState("4");
  const [skillLevel, setSkillLevel] = useState<"débutant" | "intermédiaire" | "avancé">("intermédiaire");
  const [additionalContext, setAdditionalContext] = useState("");

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/ai/generate-roadmap", {
        topic,
        numberOfWeeks: parseInt(numberOfWeeks),
        skillLevel,
        additionalContext: additionalContext || undefined,
      });
    },
    onSuccess: (data: any) => {
      setGeneratedWeeks(data.weeks);
      setStep("preview");
      toast({
        title: "🎉 Roadmap générée !",
        description: `${data.weeks.length} semaines ont été générées avec succès.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer la roadmap.",
        variant: "destructive",
      });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await onSave(generatedWeeks);
    },
    onSuccess: () => {
      toast({
        title: "✅ Roadmap sauvegardée !",
        description: `${generatedWeeks.length} semaines ont été ajoutées à votre plan.`,
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la roadmap.",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setStep("form");
    setGeneratedWeeks([]);
    setTopic("");
    setNumberOfWeeks("4");
    setSkillLevel("intermédiaire");
    setAdditionalContext("");
    onClose();
  };

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un sujet.",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate();
  };

  const handleDeleteWeek = (index: number) => {
    setGeneratedWeeks(prev => prev.filter((_, i) => i !== index));
  };

  const getObjectiveTypeColor = (type: string) => {
    switch (type) {
      case "CONCEPT": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "ALGO": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "PROJECT": return "bg-green-500/20 text-green-400 border-green-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case "DOC": return "📄";
      case "VIDEO": return "🎥";
      case "COURSE": return "📚";
      case "ARTICLE": return "📝";
      default: return "🔗";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] glass-card border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl gradient-text">
            <Sparkles className="w-7 h-7 text-primary" />
            Générer une Roadmap avec l'IA
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === "form" 
              ? "Décrivez votre projet de formation et laissez l'IA créer un plan détaillé sur plusieurs semaines."
              : "Prévisualisez et modifiez votre roadmap avant de la sauvegarder."
            }
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="topic" className="text-foreground font-semibold">
                Sujet de la formation *
              </Label>
              <Input
                id="topic"
                placeholder="Ex: Apprendre FastAPI, Créer une API REST complète, Maîtriser Django..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="glass border-white/20"
                data-testid="input-ai-topic"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weeks" className="text-foreground font-semibold">
                  Nombre de semaines *
                </Label>
                <Select value={numberOfWeeks} onValueChange={setNumberOfWeeks}>
                  <SelectTrigger className="glass border-white/20" data-testid="select-weeks">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {n} semaine{n > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="level" className="text-foreground font-semibold">
                  Niveau
                </Label>
                <Select value={skillLevel} onValueChange={(v: any) => setSkillLevel(v)}>
                  <SelectTrigger className="glass border-white/20" data-testid="select-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="débutant">Débutant</SelectItem>
                    <SelectItem value="intermédiaire">Intermédiaire</SelectItem>
                    <SelectItem value="avancé">Avancé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="context" className="text-foreground font-semibold">
                Contexte additionnel (optionnel)
              </Label>
              <Textarea
                id="context"
                placeholder="Ex: Focus sur les tests unitaires, utilisation de PostgreSQL, déploiement sur Replit..."
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="glass border-white/20 min-h-[100px]"
                data-testid="textarea-ai-context"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 glass border-white/20"
                data-testid="button-cancel-ai"
              >
                Annuler
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white shadow-lg"
                data-testid="button-generate-ai"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Générer avec l'IA
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {generatedWeeks.map((week, index) => (
                  <Card key={index} className="glass-card border-white/10">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg gradient-text flex items-center gap-2">
                            <Badge className="glass bg-primary/20 text-primary">
                              Semaine {week.weekNumber}
                            </Badge>
                            {week.title}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {week.startDate} → {week.endDate}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteWeek(index)}
                          className="hover:bg-destructive/20 hover:text-destructive"
                          data-testid={`button-delete-week-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">{week.description}</p>
                      
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="objectives" className="border-white/10">
                          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                            📚 {week.objectives.length} Objectif{week.objectives.length > 1 ? "s" : ""}
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pt-2">
                              {week.objectives.map((obj, idx) => (
                                <div key={idx} className="glass p-3 rounded-lg space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Badge className={`${getObjectiveTypeColor(obj.type)} text-xs`}>
                                      {obj.type}
                                    </Badge>
                                    <span className="text-sm font-semibold">{obj.title}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{obj.description}</p>
                                  <div className="space-y-1">
                                    {obj.tasks.map((task, tidx) => (
                                      <div key={tidx} className="flex items-center gap-2 text-xs">
                                        <CheckCircle2 className="w-3 h-3 text-primary" />
                                        <span>{task.label}</span>
                                        {task.isOptional && (
                                          <Badge variant="outline" className="text-xs">Optionnel</Badge>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {week.deliverables.length > 0 && (
                          <AccordionItem value="deliverables" className="border-white/10">
                            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                              🎯 {week.deliverables.length} Livrable{week.deliverables.length > 1 ? "s" : ""}
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pt-2">
                                {week.deliverables.map((deliv, idx) => (
                                  <div key={idx} className="glass p-3 rounded-lg space-y-1">
                                    <p className="text-sm font-semibold">{deliv.title}</p>
                                    <p className="text-xs text-muted-foreground">{deliv.description}</p>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}

                        {week.resources.length > 0 && (
                          <AccordionItem value="resources" className="border-white/10">
                            <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                              🔗 {week.resources.length} Ressource{week.resources.length > 1 ? "s" : ""}
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-1 pt-2">
                                {week.resources.map((res, idx) => (
                                  <a
                                    key={idx}
                                    href={res.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-xs text-primary hover:underline p-2 glass rounded hover-elevate"
                                  >
                                    <span>{getResourceTypeIcon(res.resourceType)}</span>
                                    <span>{res.label}</span>
                                  </a>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-3 pt-4 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => setStep("form")}
                className="glass border-white/20"
                data-testid="button-back-ai"
              >
                Retour
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || generatedWeeks.length === 0}
                className="flex-1 bg-gradient-to-r from-success to-cyan-500 text-white shadow-lg"
                data-testid="button-save-ai-roadmap"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Sauvegarder {generatedWeeks.length} semaine{generatedWeeks.length > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
