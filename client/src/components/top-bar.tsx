import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Rocket, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { getCurrentUser, logout as performLogout, isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function TopBar() {
  const { toast } = useToast();
  const user = getCurrentUser();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    toast({
      title: "Déconnexion réussie",
      description: "À bientôt !",
    });
    performLogout();
  };

  const handleSettings = () => {
    setLocation("/preferences");
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
    <header className="fixed top-0 left-0 right-0 z-[9999] w-full glass-card border-b border-white/10">
      <div className="flex h-20 items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg glow pulse-glow">
            <Rocket className="w-6 h-6 text-white icon-hover" />
          </div>
          <div>
            <h1 className="text-xl font-bold gradient-text">Roadmap Mentor</h1>
            <p className="text-xs text-muted-foreground font-medium">Backend Python Mentorat</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-foreground">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <Badge 
            className={`${
              isMentor() 
                ? "bg-gradient-to-r from-success to-cyan-500 text-white border-0 shadow-lg" 
                : "bg-gradient-to-r from-primary to-accent text-white border-0 shadow-lg"
            } px-4 py-1.5 font-semibold`}
            data-testid="badge-user-role"
          >
            {user?.role === "MENTOR" ? "Mentor" : "Apprenant"}
          </Badge>

          <Avatar className="w-11 h-11 border-2 border-primary/30 shadow-lg ring-2 ring-primary/10">
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white font-bold text-base">
              {user ? getInitials(user.fullName) : "U"}
            </AvatarFallback>
          </Avatar>

          <Button
            variant="outline"
            size="icon"
            onClick={handleSettings}
            className="glass border-white/20 glow-on-hover"
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4 icon-hover" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleLogout}
            className="glass border-white/20 glow-on-hover"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 icon-hover" />
          </Button>
        </div>
      </div>
    </header>
  );
}
