import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { TimeWindowProvider } from "./providers/TimeWindowProvider";
import Home from "./pages/Home";
import ApplianceSettings from "./pages/ApplianceSettings";
import FlowTheater from "./pages/FlowTheater";
import BlastRadius from "./pages/BlastRadius";
import Correlation from "./pages/Correlation";
import Topology from "./pages/Topology";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/settings" component={ApplianceSettings} />
        <Route path="/flow-theater" component={FlowTheater} />
        <Route path="/blast-radius" component={BlastRadius} />
        <Route path="/correlation" component={Correlation} />
        <Route path="/topology" component={Topology} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <TimeWindowProvider>
            <Toaster />
            <Router />
          </TimeWindowProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
