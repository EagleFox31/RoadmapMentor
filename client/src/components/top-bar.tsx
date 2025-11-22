import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Rocket } from "lucide-react";
import { useLocation } from "wouter";
import { getCurrentUser, logout as performLogout, isMentor } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export function TopBar() {
  const { toast } = useToast();
  const user = getCurrentUser();

  const handleLogout = () => {
    toast({
      title: "Déconnexion réussie",
      description: "À bientôt !",
    });
    performLogout();
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
    <header className="fixed top-0 left-0 right-0 z-[9999] w-full bg-card border-b border-border shadow-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary shadow-sm">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Roadmap Mentor</h1>
            <p className="text-xs text-muted-foreground">Backend Python Mentorat</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <Badge 
            className={`${
              isMentor() 
                ? "bg-[#34A853] hover:bg-[#2D9348] text-white border-0" 
                : "bg-[#4285F4] hover:bg-[#3367D6] text-white border-0"
            } px-3 py-1`}
            data-testid="badge-user-role"
          >
            {user?.role === "MENTOR" ? "Mentor" : "Apprenant"}
          </Badge>

          <Avatar className="w-10 h-10 border border-border shadow-sm">
            <AvatarFallback className="bg-primary text-white font-semibold">
              {user ? getInitials(user.fullName) : "U"}
            </AvatarFallback>
          </Avatar>

          <Button
            variant="outline"
            size="icon"
            onClick={handleLogout}
            className="shadow-sm"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
