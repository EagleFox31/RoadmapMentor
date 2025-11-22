import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send } from "lucide-react";
import type { WeekComment, User } from "@shared/schema";
import { isLearner, getCurrentUser } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface WeekCommentWithLearner extends WeekComment {
  learner: User;
}

interface WeekCommentsProps {
  comments: WeekCommentWithLearner[];
  onAddComment?: (content: string) => void;
  isLoading?: boolean;
}

export function WeekComments({ comments, onAddComment, isLoading }: WeekCommentsProps) {
  const [newComment, setNewComment] = useState("");
  const currentUser = getCurrentUser();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    onAddComment?.(newComment);
    setNewComment("");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        Commentaires & Avancement
      </h3>

      {isLearner() && (
        <Card className="bg-card rounded-xl p-4 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Partagez votre avancement, vos questions ou difficultés..."
              className="resize-none min-h-[100px]"
              data-testid="textarea-new-comment"
            />
            <Button
              type="submit"
              disabled={!newComment.trim() || isLoading}
              className="w-full bg-primary text-white"
              data-testid="button-submit-comment"
            >
              <Send className="w-4 h-4 mr-2" />
              Envoyer le commentaire
            </Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {comments.length === 0 ? (
          <Card className="bg-card rounded-xl p-6 shadow-sm text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Aucun commentaire pour le moment</p>
          </Card>
        ) : (
          comments.map((comment) => (
            <Card
              key={comment.id}
              className="bg-card rounded-xl p-4 shadow-md"
              data-testid={`comment-${comment.id}`}
            >
              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10 shadow-sm flex-shrink-0">
                  <AvatarFallback className="bg-primary text-white font-semibold text-xs">
                    {getInitials(comment.learner.fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-foreground font-semibold text-sm">
                      {comment.learner.fullName}
                    </p>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  </div>
                  <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
