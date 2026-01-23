import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Factory,
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  MapPin,
} from "lucide-react";
import { useCompany } from "@/hooks/useCompanies";
import { useFacilities, useDeleteFacility, type Facility } from "@/hooks/useFacilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { CompanyDrawer } from "@/components/companies/CompanyDrawer";
import { FacilityDrawer } from "@/components/facilities/FacilityDrawer";

const facilityTypeLabels: Record<string, string> = {
  Plant: "Zakład produkcyjny",
  Warehouse: "Magazyn",
  Office: "Biuro",
  Store: "Sklep",
};

const facilityTypeIcons: Record<string, typeof Factory> = {
  Plant: Factory,
  Warehouse: Building2,
  Office: Building2,
  Store: Building2,
};

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: company, isLoading: loadingCompany } = useCompany(id);
  const { data: facilities, isLoading: loadingFacilities } = useFacilities(id);
  const deleteFacility = useDeleteFacility();

  const [companyDrawerOpen, setCompanyDrawerOpen] = useState(false);
  const [facilityDrawerOpen, setFacilityDrawerOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [facilityToDelete, setFacilityToDelete] = useState<Facility | null>(null);

  const handleEditFacility = (facility: Facility) => {
    setEditingFacility(facility);
    setFacilityDrawerOpen(true);
  };

  const handleDeleteFacility = (facility: Facility) => {
    setFacilityToDelete(facility);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteFacility = () => {
    if (facilityToDelete) {
      deleteFacility.mutate(facilityToDelete.id);
      setDeleteDialogOpen(false);
      setFacilityToDelete(null);
    }
  };

  const handleFacilityDrawerClose = () => {
    setFacilityDrawerOpen(false);
    setEditingFacility(null);
  };

  if (loadingCompany) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-6">
        <Link to="/companies" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Powrót do listy spółek
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Spółka nie została znaleziona</h3>
            <p className="text-sm text-muted-foreground">
              Być może została usunięta lub nie masz do niej dostępu
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        to="/companies"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Powrót do listy spółek
      </Link>

      {/* Company Details Card */}
      <Card className="shadow-industrial">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{company.name}</CardTitle>
                <CardDescription>
                  {company.short_name && `${company.short_name} • `}NIP: {company.tax_id}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={company.is_active ? "default" : "secondary"}>
                {company.is_active ? "Aktywna" : "Nieaktywna"}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setCompanyDrawerOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edytuj
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Nazwa pełna</p>
              <p className="text-sm">{company.name}</p>
            </div>
            {company.short_name && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nazwa skrócona</p>
                <p className="text-sm">{company.short_name}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">NIP</p>
              <p className="text-sm">{company.tax_id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Data utworzenia</p>
              <p className="text-sm">
                {new Date(company.created_at).toLocaleDateString("pl-PL")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Facilities Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Zakłady</h2>
            <p className="text-sm text-muted-foreground">
              Lokalizacje należące do spółki {company.short_name || company.name}
            </p>
          </div>
          <Button onClick={() => setFacilityDrawerOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Dodaj zakład
          </Button>
        </div>

        {loadingFacilities ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="shadow-industrial">
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : facilities?.length === 0 ? (
          <Card className="shadow-industrial">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Factory className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">Brak zakładów</h3>
              <p className="text-sm text-muted-foreground">
                Dodaj pierwszy zakład do tej spółki
              </p>
              <Button onClick={() => setFacilityDrawerOpen(true)} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Dodaj zakład
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {facilities?.map((facility) => {
              const IconComponent = facilityTypeIcons[facility.type] || Factory;
              return (
                <Card key={facility.id} className="group shadow-industrial hover:shadow-industrial-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent">
                          <IconComponent className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{facility.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {facilityTypeLabels[facility.type]}
                          </CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditFacility(facility)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edytuj
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteFacility(facility)}
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
                    <div className="space-y-2 text-sm">
                      {facility.vet_approval_number && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>WNI: {facility.vet_approval_number}</span>
                        </div>
                      )}
                      {facility.geo_coordinates && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {facility.geo_coordinates.lat.toFixed(4)},{" "}
                            {facility.geo_coordinates.lng.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Company Drawer */}
      <CompanyDrawer
        open={companyDrawerOpen}
        onClose={() => setCompanyDrawerOpen(false)}
        company={company}
      />

      {/* Facility Drawer */}
      <FacilityDrawer
        open={facilityDrawerOpen}
        onClose={handleFacilityDrawerClose}
        facility={editingFacility}
        companyId={id!}
      />

      {/* Delete Facility Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć?</AlertDialogTitle>
            <AlertDialogDescription>
              Zakład "{facilityToDelete?.name}" zostanie trwale usunięty. Tej operacji
              nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFacility}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}