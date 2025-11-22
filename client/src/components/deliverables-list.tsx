import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Pencil, Trash2 } from "lucide-react";
import type { Deliverable } from "@shared/schema";
import { isMentor } from "@/lib/auth";

interface DeliverablesListProps {
  deliverables: Deliverable[];
  onEdit?: (deliverable: Deliverable) => void;
  onDelete?: (deliverableId: number) => void;
}

export function DeliverablesList({ deliverables, onEdit, onDelete }: DeliverablesListProps) {
  if (deliverables.length === 0) {
    return (
      <Card className="bg-card rounded-xl p-6 shadow-sm text-center">
        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground text-sm">Aucun livrable défini</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {deliverables.map((deliverable) => (
        <Card
          key={deliverable.id}
          className="bg-card rounded-xl p-5 shadow-md group hover:shadow-lg transition-shadow"
          data-testid={`card-deliverable-${deliverable.id}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-lg bg-success flex items-center justify-center shadow-sm flex-shrink-0">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-foreground font-semibold text-sm mb-1">
                  {deliverable.title}
                </h4>
                {deliverable.description && (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {deliverable.description}
                  </p>
                )}
              </div>
            </div>

            {isMentor() && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEdit?.(deliverable)}
                  className="h-8 w-8"
                  data-testid={`button-edit-deliverable-${deliverable.id}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDelete?.(deliverable.id)}
                  className="bg-destructive/10 text-destructive h-8 w-8"
                  data-testid={`button-delete-deliverable-${deliverable.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
