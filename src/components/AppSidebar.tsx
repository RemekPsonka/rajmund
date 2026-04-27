import {
  Building2,
  Settings,
  LayoutDashboard,
  Factory,
  ChevronRight,
  Package,
  FileInput,
  Layers,
  ClipboardList,
  Scale,
  Cog,
  PackageCheck,
  Truck,
  FlaskConical,
  HeartPulse,
  LogOut,
  ArrowRightLeft,
  Boxes,
  MapPin,
  GitBranch,
  Ruler,
  ListChecks,
  Box,
  Users,
  UserCog,
  Briefcase,
  Snowflake,
  Layers3,
  Shield,
  Bell,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useAlerts } from "@/hooks/useAlerts";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Pulpit", url: "/", icon: LayoutDashboard },
];

const structureItems = [
  { title: "Spółki", url: "/companies", icon: Building2 },
  { title: "Zakłady", url: "/facilities", icon: Factory },
];

const catalogItems = [
  { title: "Produkty", url: "/products", icon: Package },
];

const warehouseItems = [
  { title: "Przyjęcia (PZ)", url: "/warehouse/deliveries", icon: FileInput },
  { title: "Ewidencja Partii", url: "/warehouse/batches", icon: Layers },
  { title: "Przesunięcia (MM)", url: "/warehouse/transfers", icon: ArrowRightLeft },
  { title: "Saldo Opakowań", url: "/warehouse/packaging", icon: Boxes },
  { title: "Reklamacje", url: "/warehouse/complaints", icon: PackageCheck },
];

const productionItems = [
  { title: "Zlecenia", url: "/production/orders", icon: ClipboardList },
  { title: "Analiza przepływu", url: "/production/analytics", icon: GitBranch },
  { title: "Terminal Wagowy", url: "/production/terminal", icon: Scale },
  { title: "Terminal Masowni", url: "/production/tumbler", icon: Cog },
  { title: "Składanie Kebaba", url: "/production/assembly", icon: Layers3 },
  { title: "Mrożenie Szokowe", url: "/production/freezing", icon: Snowflake },
  { title: "Paletyzacja", url: "/production/palletization", icon: PackageCheck },
];

const shippingItems = [
  { title: "Wysyłki (WZ)", url: "/shipping", icon: Truck },
];

const hrItems = [
  { title: "Pracownicy", url: "/employees", icon: Users },
];

const devItems = [
  { title: "DEV TOOLS", url: "/dev-tools", icon: FlaskConical },
  { title: "System Health", url: "/system-health", icon: HeartPulse },
];

const settingsItems = [
  { title: "Użytkownicy", url: "/settings/users", icon: UserCog },
  { title: "Uprawnienia", url: "/settings/permissions", icon: Shield },
  { title: "Stanowiska", url: "/settings/job-positions", icon: Briefcase },
  { title: "Lokalizacje", url: "/settings/locations", icon: MapPin },
  { title: "Urządzenia", url: "/settings/devices", icon: Scale },
  { title: "Opakowania", url: "/settings/packaging-types", icon: Box },
  { title: "Jednostki miary", url: "/settings/units", icon: Ruler },
  { title: "Receptury", url: "/settings/recipes", icon: FlaskConical },
  { title: "Szablony czynności", url: "/settings/task-templates", icon: ListChecks },
  { title: "Ustawienia", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { data: alertsData } = useAlerts();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Błąd wylogowania: " + error.message);
    } else {
      toast.success("Wylogowano");
      navigate("/auth");
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <span className="text-sm font-bold text-primary-foreground">N</span>
            </div>
            <span className="font-semibold text-sidebar-foreground">NARROW OPS</span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary mx-auto">
            <span className="text-sm font-bold text-primary-foreground">N</span>
          </div>
        )}
        
        {/* Alert Bell */}
        {!collapsed && alertsData && alertsData.totalCount > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative p-1 rounded-md hover:bg-sidebar-accent transition-colors">
                <Bell className="h-5 w-5 text-sidebar-foreground" />
                <Badge
                  variant={alertsData.criticalCount > 0 ? "destructive" : "secondary"}
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
                >
                  {alertsData.totalCount}
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Alerty</h4>
                {alertsData.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                    onClick={() => alert.link && navigate(alert.link)}
                  >
                    <Badge
                      variant={
                        alert.severity === "critical"
                          ? "destructive"
                          : alert.severity === "warning"
                          ? "secondary"
                          : "outline"
                      }
                      className="mt-0.5"
                    >
                      {alert.count}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      <SidebarContent className="px-2 py-4">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Structure Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            Struktura Firmy
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {structureItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {!collapsed && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Catalog Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            Kartoteki
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {catalogItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {!collapsed && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Warehouse Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            Magazyn (WMS)
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {warehouseItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {!collapsed && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Production Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            Produkcja (MES)
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {productionItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {!collapsed && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Shipping Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            Logistyka
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {shippingItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {!collapsed && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* HR Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider">
            Pracownicy
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {hrItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {!collapsed && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dev Tools Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-xs uppercase tracking-wider text-destructive">
            Deweloper
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {devItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings Section */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Logout button */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleSignOut}
                  tooltip="Wyloguj"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Wyloguj</span>
                  {!collapsed && user && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[100px]">
                      {user.email}
                    </span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}