import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import CompaniesPage from "./pages/companies/CompaniesPage";
import CompanyDetailPage from "./pages/companies/CompanyDetailPage";
import EmployeesPage from "./pages/employees/EmployeesPage";
import ProductsPage from "./pages/products/ProductsPage";
import DeliveriesPage from "./pages/warehouse/DeliveriesPage";
import NewDeliveryPage from "./pages/warehouse/NewDeliveryPage";
import BatchesPage from "./pages/warehouse/BatchesPage";
import ProductionOrdersPage from "./pages/production/ProductionOrdersPage";
import WeighingTerminalPage from "./pages/production/WeighingTerminalPage";
import TumblerTerminalPage from "./pages/production/TumblerTerminalPage";
import PalletizationPage from "./pages/production/PalletizationPage";
import ShipmentsPage from "./pages/shipping/ShipmentsPage";
import ShipmentDetailPage from "./pages/shipping/ShipmentDetailPage";
import DevToolsPage from "./pages/dev/DevToolsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/companies/:id" element={<CompanyDetailPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/warehouse/deliveries" element={<DeliveriesPage />} />
            <Route path="/warehouse/deliveries/new" element={<NewDeliveryPage />} />
            <Route path="/warehouse/batches" element={<BatchesPage />} />
            <Route path="/production/orders" element={<ProductionOrdersPage />} />
            <Route path="/production/palletization" element={<PalletizationPage />} />
            <Route path="/shipping" element={<ShipmentsPage />} />
            <Route path="/shipping/:id" element={<ShipmentDetailPage />} />
            <Route path="/dev-tools" element={<DevToolsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          {/* Terminals without layout - full screen */}
          <Route path="/production/terminal" element={<WeighingTerminalPage />} />
          <Route path="/production/tumbler" element={<TumblerTerminalPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;