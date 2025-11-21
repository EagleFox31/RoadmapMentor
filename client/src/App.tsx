import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthPage from "@/pages/auth-page";
import RoadmapPage from "@/pages/roadmap-page";
import NotFound from "@/pages/not-found";
import { isAuthenticated } from "@/lib/auth";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (!isAuthenticated()) {
    return <Redirect to="/" />;
  }
  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  if (isAuthenticated()) {
    return <Redirect to="/roadmap" />;
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <PublicRoute component={AuthPage} />
      </Route>
      <Route path="/roadmap">
        <ProtectedRoute component={RoadmapPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
