import { useState } from "react";
import { Plus, Search, Users, QrCode, Filter, Pencil } from "lucide-react";
import { useEmployees, type Employee } from "@/hooks/useEmployees";
import { useFacilities } from "@/hooks/useFacilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeDrawer } from "@/components/employees/EmployeeDrawer";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

export default function EmployeesPage() {
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ name: string; qrCode: string } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const { data: employees, isLoading } = useEmployees(facilityFilter);
  const { data: facilities } = useFacilities();

  const filteredEmployees = employees?.filter(
    (emp) =>
      emp.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.job_position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGenerateQR = (employee: { first_name: string; last_name: string; qr_login_code: string }) => {
    setSelectedEmployee({
      name: `${employee.first_name} ${employee.last_name}`,
      qrCode: employee.qr_login_code,
    });
    setQrModalOpen(true);
  };

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setDrawerOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setEditingEmployee(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Pracownicy</h1>
          <p className="text-muted-foreground">Zarządzaj pracownikami operacyjnymi</p>
        </div>
        <Button className="gap-2" onClick={handleAddEmployee}>
          <Plus className="h-4 w-4" />
          Dodaj pracownika
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Szukaj po imieniu, nazwisku..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={facilityFilter} onValueChange={setFacilityFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtruj po zakładzie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie zakłady</SelectItem>
            {facilities?.map((facility) => (
              <SelectItem key={facility.id} value={facility.id}>
                {facility.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card className="shadow-industrial">
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredEmployees?.length === 0 ? (
        <Card className="shadow-industrial">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Brak pracowników</h3>
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Nie znaleziono pasujących wyników" : "Dodaj pierwszego pracownika"}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={handleAddEmployee}>
                <Plus className="mr-2 h-4 w-4" />
                Dodaj pracownika
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-industrial">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imię i nazwisko</TableHead>
                  <TableHead>Stanowisko</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees?.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">
                      {employee.first_name} {employee.last_name}
                    </TableCell>
                    <TableCell>{employee.job_position}</TableCell>
                    <TableCell>
                      <Badge variant={employee.is_active ? "default" : "secondary"}>
                        {employee.is_active ? "Aktywny" : "Nieaktywny"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditEmployee(employee)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleGenerateQR(employee)}>
                        <QrCode className="mr-2 h-4 w-4" />
                        Karta QR
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <EmployeeDrawer 
        open={drawerOpen} 
        onClose={handleDrawerClose} 
        employee={editingEmployee} 
      />

      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Karta Pracownika</DialogTitle>
            <DialogDescription>{selectedEmployee?.name}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="rounded-lg border bg-card p-4">
              {selectedEmployee && (
                <QRCodeSVG value={selectedEmployee.qrCode} size={200} level="H" />
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">{selectedEmployee?.qrCode}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}