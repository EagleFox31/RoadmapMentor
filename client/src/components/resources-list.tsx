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

const resourceColors = {
  DOC: "from-amber-500 to-orange-500",
  VIDEO: "from-red-500 to-pink-500",
  COURSE: "from-indigo-500 to-purple-500",
  ARTICLE: "from-blue-500 to-cyan-500",
  OTHER: "from-gray-500 to-slate-500",
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
      <Card className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-6 text-center">
        <BookOpen className="w-12 h-12 text-white/30 mx-auto mb-2" />
        <p className="text-white/50 text-sm">Aucune ressource disponible</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {resources.map((resource) => {
        const Icon = resourceIcons[resource.resourceType as keyof typeof resourceIcons] || FileText;
        const gradientClass = resourceColors[resource.resourceType as keyof typeof resourceColors];
        const typeLabel = resourceTypeLabels[resource.resourceType as keyof typeof resourceTypeLabels];

        return (
          <Card
            key={resource.id}
            className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 backdrop-blur-xl border border-amber-400/20 rounded-xl p-4 shadow-lg group hover:shadow-xl transition-all hover:-translate-y-0.5"
            data-testid={`card-resource-${resource.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-white/10 text-white border-white/20 text-xs">
                      {typeLabel}
                    </Badge>
                  </div>
                  <h4 className="text-white font-medium text-sm truncate">
                    {resource.label}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-3">
                <Button
                  size="icon"
                  variant="ghost"
                  asChild
                  className="bg-white/10 hover:bg-white/20 text-white h-8 w-8"
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
                      className="bg-white/10 hover:bg-white/20 text-white h-8 w-8"
                      data-testid={`button-edit-resource-${resource.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onDelete?.(resource.id)}
                      className="bg-red-500/20 hover:bg-red-500/30 text-red-200 h-8 w-8"
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
