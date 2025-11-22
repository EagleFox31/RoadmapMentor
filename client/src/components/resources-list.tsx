import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Video, GraduationCap, FileText, ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { Resource } from "@shared/schema";
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
  if (resources.length === 0) {
    return (
      <Card className="bg-card rounded-xl p-6 shadow-sm text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">Aucune ressource disponible</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {resources.map((resource) => {
        const Icon = resourceIcons[resource.resourceType as keyof typeof resourceIcons] || FileText;
        const colorClass = resourceColorClasses[resource.resourceType as keyof typeof resourceColorClasses];
        const typeLabel = resourceTypeLabels[resource.resourceType as keyof typeof resourceTypeLabels];

        return (
          <Card
            key={resource.id}
            className="bg-card rounded-xl p-4 shadow-md group hover:shadow-lg transition-shadow"
            data-testid={`card-resource-${resource.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-muted text-foreground border-0 text-xs">
                      {typeLabel}
                    </Badge>
                  </div>
                  <h4 className="text-foreground font-medium text-sm truncate">
                    {resource.label}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-3">
                <Button
                  size="icon"
                  variant="ghost"
                  asChild
                  className="h-8 w-8"
                  data-testid={`button-open-resource-${resource.id}`}
                >
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>

                {isMentor() && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEdit?.(resource)}
                      className="h-8 w-8"
                      data-testid={`button-edit-resource-${resource.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete?.(resource.id)}
                      className="bg-destructive/10 text-destructive h-8 w-8"
                      data-testid={`button-delete-resource-${resource.id}`}
                    >
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
  );
}
