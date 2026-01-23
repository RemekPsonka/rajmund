import { useState } from "react";
import { Plus, Search, Factory, Building2, Warehouse, Store, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useFacilities, useDeleteFacility, type Facility, type FacilityType } from "@/hooks/useFacilities";
import { useCompanies } from "@/hooks/useCompanies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FacilityDrawer } from "@/components/facilities/FacilityDrawer";

const facilityTypeLabels: Record<FacilityType, string> = {
  Plant: "Zakład produkcyjny",
  Warehouse: "Magazyn",
  Office: "Biuro",
  Store: "Sklep",
};

const facilityTypeIcons: Record<FacilityType, typeof Factory> = {
  Plant: Factory,
  Warehouse: Warehouse,
  Office: Building2,
  Store: Store,
};

export default function FacilitiesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [facilityToDelete, setFacilityToDelete] = useState<Facility | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const { data: facilities, isLoading } = useFacilities();
  const { data: companies } = useCompanies();
  const deleteFacility = useDeleteFacility();

  const filteredFacilities = facilities?.filter(
    (facility) =>
      facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      facility.vet_approval_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (facility: Facility) => {
    setEditingFacility(facility);
    setSelectedCompanyId(facility.company_id);
    setDrawerOpen(true);
  };

  const handleDelete = (facility: Facility) => {
    setFacilityToDelete(facility);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (facilityToDelete) {
      await deleteFacility.mutateAsync(facilityToDelete.id);
      setDeleteDialogOpen(false);
      setFacilityToDelete(null);
    }
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setEditingFacility(null);
    setSelectedCompanyId(null);
  };

  const handleAddNew = () => {
    setEditingFacility(null);
    // If only one company, pre-select it
    if (companies?.length === 1) {
      setSelectedCompanyId(companies[0].id);
    } else {
      setSelectedCompanyId(null);
    }
    setDrawerOpen(true);
  };

  // Group facilities by company
  const facilitiesByCompany = filteredFacilities?.reduce((acc, facility) => {
    const company = companies?.find((c) => c.id === facility.company_id);
    const companyName = company?.name || "Nieprzypisane";
    if (!acc[companyName]) {
      acc[companyName] = [];
    }
    acc[companyName].push(facility);
    return acc;
  }, {} as Record<string, Facility[]>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Zakłady</h1>
          <p className="text-muted-foreground">Zarządzaj lokalizacjami produkcyjnymi i magazynowymi</p>
        </div>
        <Button className="gap-2" onClick={handleAddNew}>
          <Plus className="h-4 w-4" />
          Dodaj zakład
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Szukaj po nazwie lub nr wet..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredFacilities?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Factory className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Brak zakładów</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Nie znaleziono pasujących wyników" : "Dodaj pierwszy zakład"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Dodaj zakład
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(facilitiesByCompany || {}).map(([companyName, companyFacilities]) => (
            <div key={companyName}>
              <h2 className="mb-4 text-lg font-medium text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                {companyName}
                <Badge variant="secondary" className="ml-2">
                  {companyFacilities.length}
                </Badge>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {companyFacilities.map((facility) => {
                  const Icon = facilityTypeIcons[facility.type];
                  return (
                    <Card key={facility.id} className="group relative">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{facility.name}</CardTitle>
                              <CardDescription>{facilityTypeLabels[facility.type]}</CardDescription>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(facility)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edytuj
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(facility)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Usuń
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {facility.vet_approval_number && (
                          <p className="text-sm text-muted-foreground">
                            Nr wet.: <span className="font-mono">{facility.vet_approval_number}</span>
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCompanyId && (
        <FacilityDrawer
          open={drawerOpen}
          onClose={handleDrawerClose}
          facility={editingFacility}
          companyId={selectedCompanyId}
        />
      )}

      {/* Show company selector if no company pre-selected */}
      {drawerOpen && !selectedCompanyId && companies && companies.length > 1 && (
        <AlertDialog open={true} onOpenChange={() => setDrawerOpen(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Wybierz spółkę</AlertDialogTitle>
              <AlertDialogDescription>
                Wybierz spółkę, do której chcesz dodać zakład
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2 py-4">
              {companies.map((company) => (
                <Button
                  key={company.id}
                  variant="outline"
                  className="justify-start"
                  onClick={() => setSelectedCompanyId(company.id)}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {company.name}
                </Button>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDrawerOpen(false)}>Anuluj</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć ten zakład?</AlertDialogTitle>
            <AlertDialogDescription>
              Zakład "{facilityToDelete?.name}" zostanie trwale usunięty. Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
