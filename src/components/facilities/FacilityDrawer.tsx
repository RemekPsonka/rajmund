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
import { Button } from "@/components/ui/button";
import {
  useCreateFacility,
  useUpdateFacility,
  type Facility,
  type FacilityType,
} from "@/hooks/useFacilities";

const facilitySchema = z.object({
  name: z.string().min(1, "Nazwa jest wymagana"),
  type: z.enum(["Plant", "Warehouse", "Office", "Store"]),
  vet_approval_number: z.string().optional(),
});

type FacilityFormValues = z.infer<typeof facilitySchema>;

const facilityTypeOptions: { value: FacilityType; label: string }[] = [
  { value: "Plant", label: "Zakład produkcyjny" },
  { value: "Warehouse", label: "Magazyn" },
  { value: "Office", label: "Biuro" },
  { value: "Store", label: "Sklep" },
];

interface FacilityDrawerProps {
  open: boolean;
  onClose: () => void;
  facility?: Facility | null;
  companyId: string;
}

export function FacilityDrawer({ open, onClose, facility, companyId }: FacilityDrawerProps) {
  const createFacility = useCreateFacility();
  const updateFacility = useUpdateFacility();
  const isEditing = !!facility;

  const form = useForm<FacilityFormValues>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      name: "",
      type: "Plant",
      vet_approval_number: "",
    },
  });

  useEffect(() => {
    if (facility) {
      form.reset({
        name: facility.name,
        type: facility.type,
        vet_approval_number: facility.vet_approval_number || "",
      });
    } else {
      form.reset({
        name: "",
        type: "Plant",
        vet_approval_number: "",
      });
    }
  }, [facility, form]);

  const onSubmit = async (values: FacilityFormValues) => {
    try {
      const formData = {
        name: values.name,
        type: values.type,
        vet_approval_number: values.vet_approval_number,
        company_id: companyId,
      };
      
      if (isEditing) {
        await updateFacility.mutateAsync({
          id: facility.id,
          ...formData,
        });
      } else {
        await createFacility.mutateAsync(formData);
      }
      onClose();
      form.reset();
    } catch {
      // Error is handled by the hook
    }
  };

  const isPending = createFacility.isPending || updateFacility.isPending;

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>
              {isEditing ? "Edytuj zakład" : "Dodaj nowy zakład"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing
                ? "Zaktualizuj dane zakładu"
                : "Wypełnij formularz, aby dodać nowy zakład"}
            </DrawerDescription>
          </DrawerHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazwa zakładu*</FormLabel>
                    <FormControl>
                      <Input placeholder="Np. Zakład Produkcyjny Myszków" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typ lokalizacji*</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz typ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {facilityTypeOptions.map((option) => (
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
                name="vet_approval_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weterynaryjny Numer Identyfikacyjny (WNI)</FormLabel>
                    <FormControl>
                      <Input placeholder="Np. PL12345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DrawerFooter className="px-0">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Zapisywanie..." : isEditing ? "Zapisz zmiany" : "Dodaj zakład"}
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