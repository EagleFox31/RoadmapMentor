import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen, Video, GraduationCap, FileText, ExternalLink, Pencil, Trash2, Play,
  Clock, CheckCircle2, Eye, Target, Sparkles, Flag, Check, AlertTriangle
} from "lucide-react";
import type { Resource } from "@shared/schema";
import { canPreviewPdf, safeExternalResourceUrl, supportedVideoEmbed } from "@shared/resourceLinks";
import { PdfResourceViewer } from "./PdfResourceViewer";
import { isMentor, getAuthToken } from "@/lib/auth";

interface ResourcesListProps {
  resources: Resource[];
  weekId: number;
  onEdit?: (resource: Resource) => void;
  onDelete?: (resourceId: number) => void;
}

const resourceIcons = {
  DOC: FileText,
  VIDEO: Video,
  COURSE: GraduationCap,
  ARTICLE: BookOpen,
  OTHER: FileText,
};

const resourceThemes = {
  DOC: {
    bgGradient: "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/20",
    badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
    badgeText: "text-amber-800 dark:text-amber-300",
    borderGlow: "hover:border-amber-500/30",
  },
  VIDEO: {
    bgGradient: "bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/20",
    badgeBg: "bg-rose-500/10 dark:bg-rose-500/20",
    badgeText: "text-rose-800 dark:text-rose-300",
    borderGlow: "hover:border-rose-500/30",
  },
  COURSE: {
    bgGradient: "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20",
    badgeBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    badgeText: "text-indigo-800 dark:text-indigo-300",
    borderGlow: "hover:border-indigo-500/30",
  },
  ARTICLE: {
    bgGradient: "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/20",
    badgeBg: "bg-teal-500/10 dark:bg-teal-500/20",
    badgeText: "text-teal-800 dark:text-teal-300",
    borderGlow: "hover:border-teal-500/30",
  },
  OTHER: {
    bgGradient: "bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/20",
    badgeBg: "bg-slate-500/10 dark:bg-slate-500/20",
    badgeText: "text-slate-800 dark:text-slate-300",
    borderGlow: "hover:border-slate-500/30",
  },
};

const resourceTypeLabels = {
  DOC: "Documentation",
  VIDEO: "Vidéo",
  COURSE: "Cours",
  ARTICLE: "Article",
  OTHER: "Autre",
};

export function ResourcesList({ resources, weekId, onEdit, onDelete }: ResourcesListProps) {
  const [activeVideo, setActiveVideo] = useState<Resource | null>(null);
  const [activePdf, setActivePdf] = useState<Resource | null>(null);
  const { toast } = useToast();
  const mentor = isMentor();
  const consultationsKey = ["/api/weeks", weekId, "resource-consultations"];
  const { data: consultations } = useQuery<{ resourceIds: number[] }>({
    queryKey: consultationsKey,
    enabled: !mentor && weekId > 0,
    queryFn: () => apiRequest("GET", `/api/weeks/${weekId}/resource-consultations`),
  });
  const consultedIds = new Set(consultations?.resourceIds ?? []);
  const consultationMutation = useMutation({
    mutationFn: ({ id, consulted }: { id: number; consulted: boolean }) =>
      apiRequest("PUT", `/api/resources/${id}/consultation`, { consulted }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: consultationsKey }),
    onError: () => toast({ title: "Impossible de mettre à jour la consultation", variant: "destructive" }),
  });
  const reportMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/resources/${id}/report-unavailable`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Lien signalé au mentor" });
    },
  });
  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/resources/${id}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/weeks"] }),
  });
  const resolveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/resources/${id}/clear-unavailable`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/weeks"] }),
  });
  const videoEmbed = activeVideo ? supportedVideoEmbed(activeVideo.url) : null;
  const activeExternalUrl = activeVideo ? safeExternalResourceUrl(activeVideo.url) : null;

  return (
    <>
      {resources.length === 0 ? (
        <Card className="bg-card rounded-xl p-6 shadow-sm text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Aucune ressource disponible</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...resources].sort((a, b) => a.orderIndex - b.orderIndex || a.id - b.id).map((resource) => {
            const type = resource.resourceType as keyof typeof resourceIcons;
            const Icon = resourceIcons[type] || FileText;
            const theme = resourceThemes[type] || resourceThemes.OTHER;
            const typeLabel = resourceTypeLabels[type] || "Autre";
            const externalUrl = safeExternalResourceUrl(resource.url);
            const isInternalDoc = resource.url.includes("/api/resources/documents/");
            const openUrl = isInternalDoc && getAuthToken() && externalUrl
              ? `${externalUrl}${externalUrl.includes("?") ? "&" : "?"}token=${getAuthToken()}`
              : externalUrl;
            const canPlay = type === "VIDEO" ? supportedVideoEmbed(resource.url) : null;
            const pdfPreview = canPreviewPdf(resource.url);
            const consulted = consultedIds.has(resource.id);

            return (
              <Card
                key={resource.id}
                className={`rounded-2xl p-5 shadow-sm transition-all duration-200 border group ${
                  consulted
                    ? "bg-emerald-500/[0.03] border-emerald-500/30 shadow-emerald-500/5"
                    : "bg-card border-border/70 hover:border-border hover:shadow-md"
                } ${theme.borderGlow}`}
                data-testid={`card-resource-${resource.id}`}
              >
                {/* 1. Header: Icon + Badges (Left) & Mentor Controls (Right) */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${theme.bgGradient} text-white`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${theme.badgeBg} ${theme.badgeText} border-0 text-xs font-semibold px-2.5 py-0.5`}>
                        {typeLabel}
                      </Badge>

                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${
                          resource.isRequired
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                            : "bg-muted text-muted-foreground"
                        }`}
                        data-testid={`resource-priority-${resource.id}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${resource.isRequired ? "bg-emerald-500" : "bg-muted-foreground/60"}`} />
                        {resource.isRequired ? "Essentielle" : "Complémentaire"}
                      </span>

                      {resource.estimatedMinutes != null && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full font-medium">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                          {resource.estimatedMinutes} min indicatives
                        </span>
                      )}

                      {consulted && !mentor && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Consultée ✓
                        </span>
                      )}
                    </div>
                  </div>

                  {mentor && (
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onEdit?.(resource)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        aria-label={`Modifier ${resource.label}`}
                        data-testid={`button-edit-resource-${resource.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onDelete?.(resource.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        aria-label={`Supprimer ${resource.label}`}
                        data-testid={`button-delete-resource-${resource.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* 2. Title: 100% full width across the entire card */}
                <h4 className="text-foreground font-bold text-base sm:text-lg leading-snug mb-3.5">
                  {resource.label}
                </h4>

                {/* 3. Pedagogical Context Boxes (Why & What to practice) */}
                {(resource.problemToSolve || resource.practicePrompt) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {resource.problemToSolve && (
                      <div className="bg-amber-500/[0.04] dark:bg-amber-500/[0.08] border border-amber-500/20 rounded-xl p-3.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider mb-1.5">
                            <Target className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Problème à résoudre</span>
                          </div>
                          <p className="text-sm text-foreground/85 leading-relaxed" data-testid={`resource-problem-${resource.id}`}>
                            {resource.problemToSolve}
                          </p>
                        </div>
                      </div>
                    )}

                    {resource.practicePrompt && (
                      <div className="bg-primary/[0.04] dark:bg-primary/[0.08] border border-primary/20 rounded-xl p-3.5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider mb-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span>À expérimenter</span>
                          </div>
                          <p className="text-sm text-foreground/85 leading-relaxed" data-testid={`resource-practice-${resource.id}`}>
                            {resource.practicePrompt}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Status & Warning Alerts */}
                {type === "VIDEO" && !canPlay && externalUrl && (
                  <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Lecture sur le site d'origine
                  </p>
                )}
                {!externalUrl && (
                  <p className="text-xs text-destructive mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Lien invalide : contactez votre mentor
                  </p>
                )}
                {mentor && !resource.isApproved && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs rounded-xl p-3 mb-3 flex items-center justify-between gap-2" data-testid={`resource-pending-${resource.id}`}>
                    <span>Lien en attente de vérification : invisible pour l'apprenant</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 font-medium"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(resource.id)}
                      data-testid={`button-approve-resource-${resource.id}`}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Vérifié — approuver
                    </Button>
                  </div>
                )}
                {resource.unavailableReportedAt && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl p-3 mb-3 flex items-center justify-between gap-2" data-testid={`resource-unavailable-${resource.id}`}>
                    <span>Lien signalé indisponible — vérification du mentor nécessaire</span>
                    {mentor && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-destructive/30 hover:bg-destructive/10 font-medium"
                        disabled={resolveMutation.isPending}
                        onClick={() => resolveMutation.mutate(resource.id)}
                        data-testid={`button-clear-report-${resource.id}`}
                      >
                        Lien corrigé
                      </Button>
                    )}
                  </div>
                )}

                {/* 4. Action Toolbar: Bottom, Separated, and Fully Responsive */}
                <div className="pt-3.5 border-t border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {pdfPreview && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => setActivePdf(resource)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm gap-2 h-9 px-3.5"
                        data-testid={`button-preview-pdf-${resource.id}`}
                      >
                        <Eye className="w-4 h-4" />
                        <span>Aperçu PDF</span>
                      </Button>
                    )}

                    {canPlay && (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => setActiveVideo(resource)}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-medium shadow-sm gap-2 h-9 px-3.5"
                        data-testid={`button-play-resource-${resource.id}`}
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>Lire la vidéo</span>
                      </Button>
                    )}

                    {openUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="border-border hover:bg-muted font-medium gap-2 h-9 px-3.5"
                        data-testid={`button-open-resource-${resource.id}`}
                      >
                        <a
                          href={openUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ouvrir ${resource.label} dans un nouvel onglet`}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Ouvrir {isInternalDoc ? "le document" : "la ressource"}</span>
                        </a>
                      </Button>
                    )}
                  </div>

                  {!mentor && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={consulted ? "secondary" : "outline"}
                        size="sm"
                        disabled={consultationMutation.isPending}
                        onClick={() => consultationMutation.mutate({ id: resource.id, consulted: !consulted })}
                        className={`font-medium gap-2 h-9 px-3.5 transition-all ${
                          consulted
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30"
                            : "border-border hover:border-emerald-500/40 hover:text-emerald-700 dark:hover:text-emerald-300"
                        }`}
                        data-testid={`button-consult-resource-${resource.id}`}
                      >
                        <CheckCircle2 className={`w-4 h-4 ${consulted ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                        <span>{consulted ? "Consultée ✓" : "Marquer comme consultée"}</span>
                      </Button>

                      {!resource.unavailableReportedAt && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={reportMutation.isPending}
                          onClick={() => reportMutation.mutate(resource.id)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs gap-1.5 h-9 px-2.5"
                          data-testid={`button-report-resource-${resource.id}`}
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>Signaler un lien</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(activeVideo)} onOpenChange={(open) => { if (!open) setActiveVideo(null); }}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{activeVideo?.label || "Vidéo"}</DialogTitle>
            <DialogDescription>
              {videoEmbed ? `Lecture intégrée depuis ${videoEmbed.provider}. La vidéo reste hébergée chez ce fournisseur.` : "Lecture indisponible dans l'application."}
            </DialogDescription>
          </DialogHeader>
          {videoEmbed && (
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                title={`Lecteur vidéo : ${activeVideo?.label ?? "Ressource"}`}
                src={videoEmbed.embedUrl}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                data-testid="iframe-resource-video"
              />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {activeExternalUrl && (
              <a href={activeExternalUrl} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary underline" data-testid="link-resource-player-fallback">
                Ouvrir la vidéo sur le site d'origine
              </a>
            )}
            <Button type="button" variant="outline" onClick={() => setActiveVideo(null)}
              data-testid="button-close-resource-player">
              Fermer le lecteur
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PdfResourceViewer
        title={activePdf?.label ?? ""}
        url={activePdf?.url ?? null}
        onClose={() => setActivePdf(null)}
      />
    </>
  );
}
