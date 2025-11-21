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
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        Commentaires & Avancement
      </h3>

      {isLearner() && (
        <Card className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Partagez votre avancement, vos questions ou difficultés..."
              className="bg-white/5 border-white/20 text-white placeholder:text-white/50 resize-none focus:bg-white/10 transition-all min-h-[100px]"
              data-testid="textarea-new-comment"
            />
            <Button
              type="submit"
              disabled={!newComment.trim() || isLoading}
              className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
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
          <Card className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-6 text-center">
            <MessageSquare className="w-12 h-12 text-white/30 mx-auto mb-2" />
            <p className="text-white/50 text-sm">Aucun commentaire pour le moment</p>
          </Card>
        ) : (
          comments.map((comment) => (
            <Card
              key={comment.id}
              className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl p-4 shadow-lg"
              data-testid={`comment-${comment.id}`}
            >
              <div className="flex items-start gap-3">
                <Avatar className="w-10 h-10 border-2 border-white/30 shadow-md flex-shrink-0">
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white font-semibold text-xs">
                    {getInitials(comment.learner.fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-white font-semibold text-sm">
                      {comment.learner.fullName}
                    </p>
                    <span className="text-white/50 text-xs">
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true,
                        locale: fr,
                      })}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
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
