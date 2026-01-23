import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateEmployee, useUpdateEmployee, type Employee } from "@/hooks/useEmployees";
import { useFacilities } from "@/hooks/useFacilities";
import { useCompanies } from "@/hooks/useCompanies";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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
  const { data: companies } = useCompanies();
  const { data: facilities } = useFacilities();

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

  const isPending = createEmployee.isPending || updateEmployee.isPending;

  return (
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
                name="job_position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stanowisko</FormLabel>
                    <FormControl>
                      <Input placeholder="Operator produkcji" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                name="facility_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zakład (opcjonalnie)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz zakład" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Brak przypisania</SelectItem>
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
  );
}
