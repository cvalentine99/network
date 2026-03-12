import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Devices from "./pages/Devices";
import Alerts from "./pages/Alerts";
import Networks from "./pages/Interfaces";
import Detections from "./pages/Performance";
import Appliances from "./pages/Appliances";
import ImpactDeck from "./pages/ImpactDeck/ImpactDeck";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={ImpactDeck} />
        <Route path="/overview" component={Home} />
        <Route path="/devices" component={Devices} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/networks" component={Networks} />
        <Route path="/detections" component={Detections} />
        <Route path="/appliances" component={Appliances} />
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
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
