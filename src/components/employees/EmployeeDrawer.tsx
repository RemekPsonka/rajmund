import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useCreateEmployee, useUpdateEmployee, type Employee } from "@/hooks/useEmployees";
import { useFacilities } from "@/hooks/useFacilities";
import { useCompanies } from "@/hooks/useCompanies";
import { useJobPositions, useCreateJobPosition } from "@/hooks/useJobPositions";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const employeeSchema = z.object({
  first_name: z.string().min(1, "Imię jest wymagane"),
  last_name: z.string().min(1, "Nazwisko jest wymagane"),
  job_position: z.string().min(1, "Stanowisko jest wymagane"),
  company_id: z.string().min(1, "Wybierz spółkę"),
  facility_id: z.string().optional(),
  is_active: z.boolean(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

interface EmployeeDrawerProps {
  open: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

export function EmployeeDrawer({ open, onClose, employee }: EmployeeDrawerProps) {
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const createJobPosition = useCreateJobPosition();
  const { data: companies } = useCompanies();
  const { data: facilities } = useFacilities();
  
  const [newPositionDialogOpen, setNewPositionDialogOpen] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      job_position: "",
      company_id: "",
      facility_id: "",
      is_active: true,
    },
  });

  const selectedCompanyId = form.watch("company_id");
  const filteredFacilities = facilities?.filter((f) => f.company_id === selectedCompanyId);
  
  // Fetch job positions for the selected company
  const { data: jobPositions } = useJobPositions(selectedCompanyId);

  useEffect(() => {
    if (employee) {
      form.reset({
        first_name: employee.first_name,
        last_name: employee.last_name,
        job_position: employee.job_position,
        company_id: employee.company_id,
        facility_id: employee.facility_id || "",
        is_active: employee.is_active,
      });
    } else {
      form.reset({
        first_name: "",
        last_name: "",
        job_position: "",
        company_id: companies?.[0]?.id || "",
        facility_id: "",
        is_active: true,
      });
    }
  }, [employee, form, companies]);

  const onSubmit = async (values: EmployeeFormValues) => {
    const formData = {
      first_name: values.first_name,
      last_name: values.last_name,
      job_position: values.job_position,
      company_id: values.company_id,
      facility_id: values.facility_id || null,
      is_active: values.is_active,
    };

    if (employee) {
      await updateEmployee.mutateAsync({ id: employee.id, ...formData });
    } else {
      await createEmployee.mutateAsync(formData);
    }

    onClose();
    form.reset();
  };

  const handleAddPosition = async () => {
    if (!newPositionName || !selectedCompanyId) return;
    
    await createJobPosition.mutateAsync({
      company_id: selectedCompanyId,
      name: newPositionName,
    });
    
    // Set the new position as selected
    form.setValue("job_position", newPositionName);
    setNewPositionDialogOpen(false);
    setNewPositionName("");
  };

  const isPending = createEmployee.isPending || updateEmployee.isPending;

  return (
    <>
      <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader>
              <DrawerTitle>{employee ? "Edytuj pracownika" : "Dodaj pracownika"}</DrawerTitle>
              <DrawerDescription>
                {employee ? "Zaktualizuj dane pracownika" : "Wprowadź dane nowego pracownika"}
              </DrawerDescription>
            </DrawerHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Imię</FormLabel>
                        <FormControl>
                          <Input placeholder="Jan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nazwisko</FormLabel>
                        <FormControl>
                          <Input placeholder="Kowalski" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spółka</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz spółkę" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies?.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="job_position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stanowisko</FormLabel>
                      <div className="flex gap-2">
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || "__custom__"}
                        >
                          <FormControl>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Wybierz stanowisko" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {jobPositions?.map((pos) => (
                              <SelectItem key={pos.id} value={pos.name}>
                                {pos.name}
                                {pos.department && (
                                  <span className="text-muted-foreground ml-2">
                                    ({pos.department})
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                            {(!jobPositions || jobPositions.length === 0) && (
                              <SelectItem value="__custom__" disabled>
                                Brak stanowisk - dodaj nowe
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setNewPositionDialogOpen(true)}
                          disabled={!selectedCompanyId}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="facility_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zakład (opcjonalnie)</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(val === "__none__" ? "" : val)} 
                        value={field.value || "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz zakład" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Brak przypisania</SelectItem>
                          {filteredFacilities?.map((facility) => (
                            <SelectItem key={facility.id} value={facility.id}>
                              {facility.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Aktywny</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Nieaktywni pracownicy nie mogą logować się do terminali
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DrawerFooter className="px-0">
                  <Button type="submit" disabled={isPending}>
                    {employee ? "Zapisz zmiany" : "Dodaj pracownika"}
                  </Button>
                  <DrawerClose asChild>
                    <Button variant="outline">Anuluj</Button>
                  </DrawerClose>
                </DrawerFooter>
              </form>
            </Form>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Add New Position Dialog */}
      <Dialog open={newPositionDialogOpen} onOpenChange={setNewPositionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nowe stanowisko</DialogTitle>
            <DialogDescription>
              Dodaj nowe stanowisko pracy do słownika
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nazwa stanowiska</Label>
              <Input
                value={newPositionName}
                onChange={(e) => setNewPositionName(e.target.value)}
                placeholder="np. Trybowszczyk"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPositionDialogOpen(false)}>
              Anuluj
            </Button>
            <Button 
              onClick={handleAddPosition} 
              disabled={!newPositionName || createJobPosition.isPending}
            >
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
