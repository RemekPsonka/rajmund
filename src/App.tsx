import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import CompaniesPage from "./pages/companies/CompaniesPage";
import CompanyDetailPage from "./pages/companies/CompanyDetailPage";
import FacilitiesPage from "./pages/facilities/FacilitiesPage";
import EmployeesPage from "./pages/employees/EmployeesPage";
import ProductsPage from "./pages/products/ProductsPage";
import DeliveriesPage from "./pages/warehouse/DeliveriesPage";
import NewDeliveryPage from "./pages/warehouse/NewDeliveryPage";
import BatchesPage from "./pages/warehouse/BatchesPage";
import TransfersPage from "./pages/warehouse/TransfersPage";
import NewTransferPage from "./pages/warehouse/NewTransferPage";
import PackagingBalancePage from "./pages/warehouse/PackagingBalancePage";
import ComplaintsPage from "./pages/warehouse/ComplaintsPage";
import ProductionOrdersPage from "./pages/production/ProductionOrdersPage";
import ProductionOrderDetailPage from "./pages/production/ProductionOrderDetailPage";
import ProductionAnalyticsPage from "./pages/production/ProductionAnalyticsPage";
import WeighingTerminalPage from "./pages/production/WeighingTerminalPage";
import TumblerTerminalPage from "./pages/production/TumblerTerminalPage";
import KebabAssemblyTerminalPage from "./pages/production/KebabAssemblyTerminalPage";
import ShockFreezingTerminalPage from "./pages/production/ShockFreezingTerminalPage";
import PalletizationPage from "./pages/production/PalletizationPage";
import ShipmentsPage from "./pages/shipping/ShipmentsPage";
import ShipmentDetailPage from "./pages/shipping/ShipmentDetailPage";
import StorageLocationsPage from "./pages/settings/StorageLocationsPage";
import DevicesPage from "./pages/settings/DevicesPage";
import PackagingTypesPage from "./pages/settings/PackagingTypesPage";
import UnitsOfMeasurePage from "./pages/settings/UnitsOfMeasurePage";
import RecipesPage from "./pages/settings/RecipesPage";
import TaskTemplatesPage from "./pages/settings/TaskTemplatesPage";
import UsersPage from "./pages/settings/UsersPage";
import PermissionsPage from "./pages/settings/PermissionsPage";
import JobPositionsPage from "./pages/settings/JobPositionsPage";
import DevToolsPage from "./pages/dev/DevToolsPage";
import SystemHealthPage from "./pages/dev/SystemHealthPage";
import SettingsPage from "./pages/SettingsPage";
import LotGenealogyPage from "./pages/genealogy/LotGenealogyPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* All routes with layout */}
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/companies/:id" element={<CompanyDetailPage />} />
            <Route path="/facilities" element={<FacilitiesPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/warehouse/deliveries" element={<DeliveriesPage />} />
            <Route path="/warehouse/deliveries/new" element={<NewDeliveryPage />} />
            <Route path="/warehouse/batches" element={<BatchesPage />} />
            <Route path="/warehouse/transfers" element={<TransfersPage />} />
            <Route path="/warehouse/transfers/new" element={<NewTransferPage />} />
            <Route path="/warehouse/packaging" element={<PackagingBalancePage />} />
            <Route path="/warehouse/complaints" element={<ComplaintsPage />} />
            <Route path="/production/orders" element={<ProductionOrdersPage />} />
            <Route path="/production/orders/:id" element={<ProductionOrderDetailPage />} />
            <Route path="/production/analytics" element={<ProductionAnalyticsPage />} />
            <Route path="/production/palletization" element={<PalletizationPage />} />
            <Route path="/shipping" element={<ShipmentsPage />} />
            <Route path="/shipping/:id" element={<ShipmentDetailPage />} />
            <Route path="/dev-tools" element={<DevToolsPage />} />
            <Route path="/dev/seed" element={<DevToolsPage />} />
            <Route path="/system-health" element={<SystemHealthPage />} />
            <Route path="/settings/locations" element={<StorageLocationsPage />} />
            <Route path="/settings/devices" element={<DevicesPage />} />
            <Route path="/settings/packaging-types" element={<PackagingTypesPage />} />
            <Route path="/settings/units" element={<UnitsOfMeasurePage />} />
            <Route path="/settings/recipes" element={<RecipesPage />} />
            <Route path="/settings/task-templates" element={<TaskTemplatesPage />} />
            <Route path="/settings/users" element={<UsersPage />} />
            <Route path="/settings/permissions" element={<PermissionsPage />} />
            <Route path="/settings/job-positions" element={<JobPositionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/genealogia/:lotId" element={<LotGenealogyPage />} />
          </Route>
          
          {/* Terminals without layout - full screen */}
          <Route path="/production/terminal" element={<WeighingTerminalPage />} />
          <Route path="/production/tumbler" element={<TumblerTerminalPage />} />
          <Route path="/production/assembly" element={<KebabAssemblyTerminalPage />} />
          <Route path="/production/freezing" element={<ShockFreezingTerminalPage />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
