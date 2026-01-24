import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import {
  useCreateProductionOrder,
  generateOrderNumber,
  type ProductionOrderType,
} from "@/hooks/useProductionOrders";

const orderSchema = z.object({
  company_id: z.string().min(1, "Wybierz spółkę"),
  facility_id: z.string().min(1, "Wybierz zakład"),
  type: z.enum(["Decomposition", "Processing", "Packing", "Assembly", "Freezing"]),
  production_date: z.string().min(1, "Wybierz datę"),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

const typeOptions: { value: ProductionOrderType; label: string }[] = [
  { value: "Decomposition", label: "Rozbiór" },
  { value: "Processing", label: "Przetwórstwo" },
  { value: "Packing", label: "Pakowanie" },
  { value: "Assembly", label: "Składanie Kebaba" },
  { value: "Freezing", label: "Mrożenie" },
];

interface ProductionOrderDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ProductionOrderDrawer({ open, onClose }: ProductionOrderDrawerProps) {
  const createOrder = useCreateProductionOrder();
  const { data: companies } = useCompanies();
  const { data: facilities } = useFacilities();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      company_id: "",
      facility_id: "",
      type: "Decomposition",
      production_date: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  const selectedCompanyId = form.watch("company_id");
  const selectedType = form.watch("type");
  const filteredFacilities = facilities?.filter((f) => f.company_id === selectedCompanyId);

  useEffect(() => {
    if (companies?.[0]) {
      form.setValue("company_id", companies[0].id);
    }
  }, [companies, form]);

  const onSubmit = async (values: OrderFormValues) => {
    try {
      const orderNumber = generateOrderNumber(values.type);
      
      await createOrder.mutateAsync({
        company_id: values.company_id,
        facility_id: values.facility_id,
        order_number: orderNumber,
        type: values.type,
        production_date: values.production_date,
        notes: values.notes,
      });
      
      onClose();
      form.reset();
    } catch {
      // Error handled by hook
    }
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>Nowe zlecenie produkcyjne</DrawerTitle>
            <DrawerDescription>
              Utwórz zlecenie rozbioru, przetwórstwa lub pakowania
            </DrawerDescription>
          </DrawerHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
              <FormField
                control={form.control}
                name="company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Spółka*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz spółkę" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.short_name || company.name}
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
                    <FormLabel>Zakład*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCompanyId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz zakład" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Typ zlecenia*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {typeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                  name="production_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data produkcji*</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-sm text-muted-foreground">
                  Nr zlecenia: <strong>{generateOrderNumber(selectedType)}</strong>
                </p>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notatki</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Opcjonalne uwagi..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DrawerFooter className="px-0">
                <Button type="submit" disabled={createOrder.isPending}>
                  {createOrder.isPending ? "Tworzenie..." : "Utwórz zlecenie"}
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Anuluj
                </Button>
              </DrawerFooter>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}