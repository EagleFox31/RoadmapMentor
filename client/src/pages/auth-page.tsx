import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Rocket, Code, Database, Cloud } from "lucide-react";
import { setAuthToken, setCurrentUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "LEARNER" as "MENTOR" | "LEARNER",
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
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-[#667eea] via-[#764ba2] to-[#1e3a8a]">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-20 text-[200px]">
          <Rocket className="w-48 h-48 rotate-45 opacity-20" />
        </div>
        <div className="absolute bottom-20 right-20 text-[200px]">
          <Code className="w-48 h-48 -rotate-12 opacity-20" />
        </div>
        <div className="absolute top-1/2 left-1/3">
          <Database className="w-32 h-32 opacity-15" />
        </div>
        <div className="absolute top-1/3 right-1/4">
          <Cloud className="w-40 h-40 opacity-15" />
        </div>
      </div>

      {/* Auth Card */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl p-8 animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 mb-4 shadow-lg">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Pavel Roadmap
            </h1>
            <p className="text-white/80 text-sm">
              Suivi de Mentorat Backend Python
            </p>
          </div>

          <div className="flex gap-2 mb-6">
            <Button
              type="button"
              variant={isLogin ? "default" : "outline"}
              className={`flex-1 ${isLogin ? "bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600" : "bg-white/5 border-white/20 text-white hover:bg-white/10"} transition-all`}
              onClick={() => setIsLogin(true)}
              data-testid="button-show-login"
            >
              Connexion
            </Button>
            <Button
              type="button"
              variant={!isLogin ? "default" : "outline"}
              className={`flex-1 ${!isLogin ? "bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600" : "bg-white/5 border-white/20 text-white hover:bg-white/10"} transition-all`}
              onClick={() => setIsLogin(false)}
              data-testid="button-show-register"
            >
              Inscription
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-white text-sm font-medium">
                  Nom complet
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Pavel Durov"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 transition-all"
                  data-testid="input-fullname"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="pavel@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 transition-all"
                data-testid="input-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white text-sm font-medium">
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/15 transition-all"
                data-testid="input-password"
              />
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="role" className="text-white text-sm font-medium">
                  Rôle
                </Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as "MENTOR" | "LEARNER" })}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 focus:bg-white/15 transition-all"
                  data-testid="select-role"
                >
                  <option value="LEARNER" className="bg-gray-800">Apprenant</option>
                  <option value="MENTOR" className="bg-gray-800">Mentor</option>
                </select>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-200"
              data-testid="button-submit-auth"
            >
              {isLoading ? "Chargement..." : isLogin ? "Se connecter" : "S'inscrire"}
            </Button>
          </form>

          <p className="text-center text-white/60 text-xs mt-6">
            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sky-300 hover:text-sky-200 underline transition-colors"
              data-testid="button-toggle-auth-mode"
            >
              {isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}
