import { useState } from "react";
import { Shield, Check, X } from "lucide-react";
import {
  useRolePermissions,
  useUpdateRolePermission,
  ROLE_LABELS,
  RESOURCE_LABELS,
  type AppRole,
  type Resource,
} from "@/hooks/useRolePermissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

const ROLES: AppRole[] = ["global_admin", "facility_admin", "operator", "viewer"];
const RESOURCES: Resource[] = [
  "companies",
  "facilities",
  "employees",
  "products",
  "batches",
  "production_orders",
  "shipments",
  "warehouse_movements",
  "users",
  "settings",
];

export default function PermissionsPage() {
  const [selectedRole, setSelectedRole] = useState<AppRole>("facility_admin");
  const { data: permissions, isLoading } = useRolePermissions(selectedRole);
  const updatePermission = useUpdateRolePermission();

  const getPermission = (resource: Resource) => {
    return permissions?.find((p) => p.resource === resource);
  };

  const handleToggle = async (
    resource: Resource,
    field: "can_create" | "can_read" | "can_update" | "can_delete",
    currentValue: boolean
  ) => {
    const permission = getPermission(resource);
    if (!permission) return;

    // Global admin cannot be modified
    if (selectedRole === "global_admin") return;

    await updatePermission.mutateAsync({
      id: permission.id,
      [field]: !currentValue,
    });
  };

  const isGlobalAdmin = selectedRole === "global_admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Uprawnienia ról</h1>
          <p className="text-muted-foreground">
            Konfiguruj uprawnienia dla każdej roli w systemie
          </p>
        </div>
      </div>

      <Card className="shadow-industrial">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Matryca uprawnień
              </CardTitle>
              <CardDescription>
                Wybierz rolę i skonfiguruj dostęp do poszczególnych modułów
              </CardDescription>
            </div>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Wybierz rolę" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isGlobalAdmin && (
            <div className="mb-4 p-3 rounded-lg bg-muted">
              <p className="text-sm text-muted-foreground">
                <strong>Administrator Globalny</strong> ma pełny dostęp do wszystkich modułów.
                Uprawnienia tej roli nie mogą być modyfikowane.
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Moduł</TableHead>
                  <TableHead className="text-center">Podgląd</TableHead>
                  <TableHead className="text-center">Tworzenie</TableHead>
                  <TableHead className="text-center">Edycja</TableHead>
                  <TableHead className="text-center">Usuwanie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RESOURCES.map((resource) => {
                  const perm = getPermission(resource);
                  return (
                    <TableRow key={resource}>
                      <TableCell className="font-medium">
                        {RESOURCE_LABELS[resource]}
                      </TableCell>
                      <TableCell className="text-center">
                        {isGlobalAdmin ? (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <Checkbox
                            checked={perm?.can_read ?? false}
                            onCheckedChange={() =>
                              handleToggle(resource, "can_read", perm?.can_read ?? false)
                            }
                            disabled={updatePermission.isPending}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isGlobalAdmin ? (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <Checkbox
                            checked={perm?.can_create ?? false}
                            onCheckedChange={() =>
                              handleToggle(resource, "can_create", perm?.can_create ?? false)
                            }
                            disabled={updatePermission.isPending}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isGlobalAdmin ? (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <Checkbox
                            checked={perm?.can_update ?? false}
                            onCheckedChange={() =>
                              handleToggle(resource, "can_update", perm?.can_update ?? false)
                            }
                            disabled={updatePermission.isPending}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isGlobalAdmin ? (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                          </Badge>
                        ) : (
                          <Checkbox
                            checked={perm?.can_delete ?? false}
                            onCheckedChange={() =>
                              handleToggle(resource, "can_delete", perm?.can_delete ?? false)
                            }
                            disabled={updatePermission.isPending}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role descriptions */}
      <Card className="shadow-industrial">
        <CardHeader>
          <CardTitle>Opis ról</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-lg border">
              <h4 className="font-semibold text-primary">Administrator Globalny</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Pełny dostęp do wszystkich funkcji systemu. Może zarządzać firmami, użytkownikami i
                ustawieniami.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <h4 className="font-semibold text-blue-600">Administrator Zakładu</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Zarządza operacjami w przypisanym zakładzie. Może tworzyć zlecenia, zarządzać
                pracownikami i produktami.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <h4 className="font-semibold text-green-600">Operator</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Wykonuje codzienne operacje produkcyjne i magazynowe. Może rejestrować wagę,
                tworzyć partie i ruchy magazynowe.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <h4 className="font-semibold text-gray-600">Podgląd</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Tylko odczyt danych. Może przeglądać raporty, zlecenia i stany magazynowe bez
                możliwości edycji.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
