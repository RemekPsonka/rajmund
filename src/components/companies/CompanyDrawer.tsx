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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCreateCompany, useUpdateCompany, type Company } from "@/hooks/useCompanies";

const companySchema = z.object({
  name: z.string().min(1, "Nazwa jest wymagana"),
  short_name: z.string().optional(),
  tax_id: z
    .string()
    .min(10, "NIP musi mieć 10 znaków")
    .max(10, "NIP musi mieć 10 znaków")
    .regex(/^\d+$/, "NIP może zawierać tylko cyfry"),
  is_active: z.boolean().default(true),
});

type CompanyFormValues = z.infer<typeof companySchema>;

interface CompanyDrawerProps {
  open: boolean;
  onClose: () => void;
  company?: Company | null;
}

export function CompanyDrawer({ open, onClose, company }: CompanyDrawerProps) {
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();
  const isEditing = !!company;

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      short_name: "",
      tax_id: "",
      is_active: true,
    },
  });

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        short_name: company.short_name || "",
        tax_id: company.tax_id,
        is_active: company.is_active,
      });
    } else {
      form.reset({
        name: "",
        short_name: "",
        tax_id: "",
        is_active: true,
      });
    }
  }, [company, form]);

  const onSubmit = async (values: CompanyFormValues) => {
    try {
      const formData = {
        name: values.name,
        short_name: values.short_name,
        tax_id: values.tax_id,
        is_active: values.is_active,
      };
      
      if (isEditing) {
        await updateCompany.mutateAsync({
          id: company.id,
          ...formData,
        });
      } else {
        await createCompany.mutateAsync(formData);
      }
      onClose();
      form.reset();
    } catch {
      // Error is handled by the hook
    }
  };

  const isPending = createCompany.isPending || updateCompany.isPending;

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>
              {isEditing ? "Edytuj spółkę" : "Dodaj nową spółkę"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing
                ? "Zaktualizuj dane spółki"
                : "Wypełnij formularz, aby dodać nową spółkę do systemu"}
            </DrawerDescription>
          </DrawerHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pełna nazwa*</FormLabel>
                    <FormControl>
                      <Input placeholder="Np. Nazwa Spółka z o.o." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="short_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazwa skrócona</FormLabel>
                    <FormControl>
                      <Input placeholder="Np. NAZWA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIP*</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0000000000"
                        maxLength={10}
                        {...field}
                        disabled={isEditing}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Aktywna</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Spółka jest widoczna w systemie
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
                  {isPending ? "Zapisywanie..." : isEditing ? "Zapisz zmiany" : "Dodaj spółkę"}
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