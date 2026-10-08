import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setAuthToken, setCurrentUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const STEPS = [
  { label: "Fondations Python", state: "done" },
  { label: "API et persistance", state: "done" },
  { label: "Tests et qualité", state: "current" },
  { label: "Déploiement", state: "todo" },
] as const;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await apiRequest("POST", endpoint, payload);

      setAuthToken(response.token);
      setCurrentUser(response.user);

      toast({
        title: "Authentification réussie",
        description: `Bienvenue ${response.user.fullName} !`,
      });

      setLocation("/roadmap");
    } catch (error: any) {
      toast({
        title: "Erreur d'authentification",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] w-full grid lg:grid-cols-[1.1fr_1fr] bg-background">
      <section
        aria-hidden="true"
        className="hidden lg:flex flex-col justify-between bg-foreground text-background p-14"
      >
        <span className="text-sm font-medium tracking-wide">Roadmap Mentor</span>

        <div>
          <h2 className="text-5xl font-semibold leading-[1.05] tracking-tight max-w-md">
            Un parcours, un mentor, des preuves.
          </h2>
          <ol className="mt-12 space-y-5 max-w-sm">
            {STEPS.map((step, i) => (
              <li key={step.label} className="flex items-center gap-4">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums ${
                    step.state === "done"
                      ? "bg-background text-foreground border-background"
                      : step.state === "current"
                        ? "border-background"
                        : "border-background/30 text-background/50"
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={
                    step.state === "todo" ? "text-background/50" : "text-background"
                  }
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-sm text-background/60">
          Suivi de mentorat backend Python
        </p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="lg:hidden text-sm font-medium mb-6">Roadmap Mentor</p>
          <div role="tablist" className="mb-8 flex gap-6 border-b">
            {[
              { login: true, label: "Connexion", testId: "button-show-login" },
              { login: false, label: "Inscription", testId: "button-show-register" },
            ].map((tab) => (
              <button
                key={tab.testId}
                type="button"
                role="tab"
                aria-selected={isLogin === tab.login}
                onClick={() => setIsLogin(tab.login)}
                className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${
                  isLogin === tab.login
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid={tab.testId}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isLogin ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isLogin
              ? "Reprenez votre parcours là où vous l'avez laissé."
              : "Rejoignez votre mentor et suivez votre progression."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="Pavel Durov"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  data-testid="input-fullname"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="pavel@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              data-testid="button-submit-auth"
            >
              {isLoading ? "Chargement…" : isLogin ? "Se connecter" : "S'inscrire"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
              data-testid="button-toggle-auth-mode"
            >
              {isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
