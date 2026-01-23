import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useLocation, Link } from "react-router-dom";

const routeNames: Record<string, string> = {
  "/": "Pulpit",
  "/companies": "Spółki",
  "/facilities": "Zakłady",
  "/employees": "Pracownicy",
  "/products": "Produkty",
  "/warehouse": "Magazyn",
  "/warehouse/deliveries": "Przyjęcia (PZ)",
  "/warehouse/deliveries/new": "Nowa dostawa",
  "/warehouse/batches": "Ewidencja Partii",
  "/warehouse/transfers": "Przesunięcia (MM)",
  "/warehouse/transfers/new": "Nowe przesunięcie",
  "/warehouse/packaging": "Saldo Opakowań",
  "/production": "Produkcja",
  "/production/orders": "Zlecenia",
  "/production/analytics": "Analiza przepływu",
  "/production/terminal": "Terminal Wagowy",
  "/production/tumbler": "Terminal Masowni",
  "/production/palletization": "Paletyzacja",
  "/shipping": "Wysyłki",
  "/settings": "Ustawienia",
  "/settings/locations": "Lokalizacje",
};

export function DashboardLayout() {
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const getBreadcrumbs = () => {
    const crumbs = [{ path: "/", name: "Pulpit" }];
    
    let currentPath = "";
    for (const segment of pathSegments) {
      currentPath += `/${segment}`;
      const name = routeNames[currentPath] || segment;
      crumbs.push({ path: currentPath, name });
    }
    
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-4">
            <SidebarTrigger className="-ml-1 h-8 w-8" />
            <Separator orientation="vertical" className="h-6" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <BreadcrumbItem key={crumb.path}>
                    {index < breadcrumbs.length - 1 ? (
                      <>
                        <BreadcrumbLink asChild>
                          <Link to={crumb.path}>{crumb.name}</Link>
                        </BreadcrumbLink>
                        <BreadcrumbSeparator />
                      </>
                    ) : (
                      <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto bg-background p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}