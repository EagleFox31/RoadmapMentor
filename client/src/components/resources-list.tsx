import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Video, GraduationCap, FileText, ExternalLink, Pencil, Trash2, Play } from "lucide-react";
import type { Resource } from "@shared/schema";
import { safeExternalResourceUrl, supportedVideoEmbed } from "@shared/resourceLinks";
import { isMentor } from "@/lib/auth";

interface ResourcesListProps {
  resources: Resource[];
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
const resourceColorClasses = {
  DOC: "bg-warning",
  VIDEO: "bg-destructive",
  COURSE: "bg-accent",
  ARTICLE: "bg-primary",
  OTHER: "bg-muted",
};
const resourceTypeLabels = {
  DOC: "Documentation",
  VIDEO: "Vidéo",
  COURSE: "Cours",
  ARTICLE: "Article",
  OTHER: "Autre",
};

export function ResourcesList({ resources, onEdit, onDelete }: ResourcesListProps) {
  const [activeVideo, setActiveVideo] = useState<Resource | null>(null);
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
            const colorClass = resourceColorClasses[type] || "bg-muted";
            const typeLabel = resourceTypeLabels[type] || "Autre";
            const externalUrl = safeExternalResourceUrl(resource.url);
            const canPlay = type === "VIDEO" ? supportedVideoEmbed(resource.url) : null;

            return (
              <Card key={resource.id} className="bg-card rounded-xl p-4 shadow-md group hover:shadow-lg transition-shadow" data-testid={`card-resource-${resource.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 ${colorClass}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Badge className="bg-muted text-foreground border-0 text-xs mb-1">{typeLabel}</Badge>
                      <h4 className="text-foreground font-medium text-sm truncate">{resource.label}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span data-testid={`resource-priority-${resource.id}`}>
                          {resource.isRequired ? "Essentielle" : "Complémentaire"}
                        </span>
                        {resource.estimatedMinutes != null && (
                          <span>{resource.estimatedMinutes} min indicatives</span>
                        )}
                      </div>
                      {resource.problemToSolve && (
                        <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap" data-testid={`resource-problem-${resource.id}`}>
                          <strong>Problème à résoudre :</strong> {resource.problemToSolve}
                        </p>
                      )}
                      {resource.practicePrompt && (
                        <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap" data-testid={`resource-practice-${resource.id}`}>
                          <strong>À expérimenter :</strong> {resource.practicePrompt}
                        </p>
                      )}
                      {type === "VIDEO" && !canPlay && externalUrl && (
                        <span className="text-xs text-muted-foreground">Lecture sur le site d'origine</span>
                      )}
                      {!externalUrl && (
                        <span className="text-xs text-destructive">Lien invalide : contactez votre mentor</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {canPlay && (
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => setActiveVideo(resource)}
                        data-testid={`button-play-resource-${resource.id}`}>
                        <Play className="w-4 h-4 mr-1" />
                        Lire ici
                      </Button>
                    )}
                    {externalUrl && (
                      <Button size="icon" variant="ghost" asChild className="h-8 w-8"
                        data-testid={`button-open-resource-${resource.id}`}>
                        <a href={externalUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${resource.label} dans un nouvel onglet`}>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    {isMentor() && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" onClick={() => onEdit?.(resource)}
                          className="h-8 w-8" aria-label={`Modifier ${resource.label}`}
                          data-testid={`button-edit-resource-${resource.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete?.(resource.id)}
                          className="bg-destructive/10 text-destructive h-8 w-8"
                          aria-label={`Supprimer ${resource.label}`}
                          data-testid={`button-delete-resource-${resource.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
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
    </>
  );
}
