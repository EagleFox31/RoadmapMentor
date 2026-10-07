import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated, setAuthToken, setCurrentUser, removeAuthToken } from "@/lib/auth";
import { ApiError, apiRequest } from "@/lib/queryClient";

type InvitationInfo = {
  email: string;
  roadmapId: number;
  roadmapTitle: string;
  mentorName: string;
  expiresAt: string;
};

const stripStatus = (message: string) => message.replace(/^\d{3}:\s*/, "");

function problemMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "INVITATION_NOT_FOUND") return "Ce lien d’invitation est invalide.";
  const raw = error instanceof Error ? error.message : "";
  return raw ? stripStatus(raw) : "Une erreur est survenue.";
}

export default function InvitePage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({ fullName: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const signedIn = isAuthenticated();
  const invitation = useQuery<InvitationInfo>({
    queryKey: [`/api/invitations/token/${token}`],
    enabled: !!token && !signedIn,
    retry: false,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await apiRequest("POST", `/api/invitations/token/${token}/accept`, form);
      setAuthToken(response.token);
      setCurrentUser(response.user);
      toast({ title: "Compte créé", description: `Bienvenue ${response.user.fullName} !` });
      setLocation("/roadmap");
    } catch (error) {
      setSubmitError(problemMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-[#667eea] via-[#764ba2] to-[#1e3a8a]">
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 mb-4 shadow-lg">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white" data-testid="text-invite-title">
              Invitation
            </h1>
          </div>

          {signedIn && (
            <div className="space-y-4 text-center text-white/90" data-testid="invite-signed-in">
              <p>Vous êtes déjà connecté. Déconnectez-vous pour accepter cette invitation avec le bon compte.</p>
              <Button
                variant="outline"
                onClick={() => {
                  removeAuthToken();
                  window.location.reload();
                }}
                data-testid="button-invite-logout"
              >
                Se déconnecter
              </Button>
            </div>
          )}

          {!signedIn && invitation.isLoading && (
            <div className="flex justify-center text-white" role="status">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!signedIn && invitation.error && (
            <div className="space-y-4 text-center text-white/90" role="alert" data-testid="invite-problem">
              <p>{problemMessage(invitation.error)}</p>
              <Button variant="outline" onClick={() => setLocation("/login")} data-testid="button-invite-login">
                Aller à la connexion
              </Button>
            </div>
          )}

          {!signedIn && invitation.data && (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-invite">
              <p className="text-center text-white/90" data-testid="text-invite-context">
                <strong>{invitation.data.mentorName}</strong> vous invite à rejoindre la roadmap{" "}
                <strong>{invitation.data.roadmapTitle}</strong>.
              </p>
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="text-white">E-mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={invitation.data.email}
                  readOnly
                  data-testid="input-invite-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name" className="text-white">Nom complet</Label>
                <Input
                  id="invite-name"
                  required
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  data-testid="input-invite-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-password" className="text-white">Mot de passe (8 caractères minimum)</Label>
                <Input
                  id="invite-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  data-testid="input-invite-password"
                />
              </div>
              {submitError && (
                <p className="text-sm text-red-200" role="alert" data-testid="text-invite-error">
                  {submitError}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={submitting} data-testid="button-invite-accept">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer mon compte
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
