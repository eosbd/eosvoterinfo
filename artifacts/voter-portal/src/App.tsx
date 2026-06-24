import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import SearchResults from "./pages/search";
import VoterProfile from "./pages/voter-profile";
import AdminLogin from "./pages/admin/login";
import AdminDashboard from "./pages/admin/dashboard";
import AdminVoters from "./pages/admin/voters";
import AdminUpload from "./pages/admin/upload";
import ApiDocs from "./pages/api-docs";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={SearchResults} />
      <Route path="/voter/:id" component={VoterProfile} />
      
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/voters" component={AdminVoters} />
      <Route path="/admin/upload" component={AdminUpload} />
      <Route path="/api-docs" component={ApiDocs} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
