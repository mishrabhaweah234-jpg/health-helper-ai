import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PatientAuthProvider, usePatientAuth } from "@/hooks/usePatientAuth";
import { DoctorAuthProvider, useDoctorAuth } from "@/hooks/useDoctorAuth";
import PatientAuth from "./pages/PatientAuth";
import DoctorAuth from "./pages/DoctorAuth";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function PatientProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = usePatientAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

function DoctorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useDoctorAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth/doctor" replace />;
  }
  
  return <>{children}</>;
}

function PatientAuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = usePatientAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/patient" replace />;
  }
  
  return <>{children}</>;
}

function DoctorAuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useDoctorAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/doctor" replace />;
  }
  
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<PatientAuthRoute><PatientAuth /></PatientAuthRoute>} />
    <Route path="/auth/doctor" element={<DoctorAuthRoute><DoctorAuth /></DoctorAuthRoute>} />
    <Route 
      path="/patient" 
      element={
        <PatientProtectedRoute>
          <PatientDashboard />
        </PatientProtectedRoute>
      } 
    />
    <Route 
      path="/doctor" 
      element={
        <DoctorProtectedRoute>
          <DoctorDashboard />
        </DoctorProtectedRoute>
      } 
    />
    <Route path="/" element={<Navigate to="/auth" replace />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PatientAuthProvider>
            <DoctorAuthProvider>
              <AppRoutes />
            </DoctorAuthProvider>
          </PatientAuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
