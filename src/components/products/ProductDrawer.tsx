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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProduct, useUpdateProduct, type Product, INDUSTRY_CATEGORIES, type IndustryCategory } from "@/hooks/useProducts";
import { useCompanies } from "@/hooks/useCompanies";

const productSchema = z.object({
  company_id: z.string().min(1, "Wybierz spółkę"),
  name: z.string().min(1, "Nazwa jest wymagana"),
  sku: z.string().optional(),
  unit: z.string().default("kg"),
  is_raw_material: z.boolean().default(true),
  industry_category: z.string().optional(),
  default_expiration_days: z.coerce.number().optional(),
  min_storage_temp: z.coerce.number().optional(),
  max_storage_temp: z.coerce.number().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductDrawerProps {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
}

export function ProductDrawer({ open, onClose, product }: ProductDrawerProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: companies } = useCompanies();
  const isEditing = !!product;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      company_id: "",
      name: "",
      sku: "",
      unit: "kg",
      is_raw_material: true,
      industry_category: undefined,
      default_expiration_days: undefined,
      min_storage_temp: undefined,
      max_storage_temp: undefined,
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        company_id: product.company_id,
        name: product.name,
        sku: product.sku || "",
        unit: product.unit,
        is_raw_material: product.is_raw_material,
        industry_category: product.industry_category || undefined,
        default_expiration_days: product.default_expiration_days || undefined,
        min_storage_temp: product.min_storage_temp || undefined,
        max_storage_temp: product.max_storage_temp || undefined,
      });
    } else {
      form.reset({
        company_id: companies?.[0]?.id || "",
        name: "",
        sku: "",
        unit: "kg",
        is_raw_material: true,
        industry_category: undefined,
        default_expiration_days: undefined,
        min_storage_temp: undefined,
        max_storage_temp: undefined,
      });
    }
  }, [product, companies, form]);

  const onSubmit = async (values: ProductFormValues) => {
    try {
      const formData = {
        company_id: values.company_id,
        name: values.name,
        sku: values.sku || undefined,
        unit: values.unit,
        is_raw_material: values.is_raw_material,
        industry_category: values.industry_category as IndustryCategory | undefined,
        default_expiration_days: values.default_expiration_days,
        min_storage_temp: values.min_storage_temp,
        max_storage_temp: values.max_storage_temp,
      };

      if (isEditing) {
        await updateProduct.mutateAsync({ id: product.id, ...formData });
      } else {
        await createProduct.mutateAsync(formData);
      }
      onClose();
      form.reset();
    } catch {
      // Error handled by hook
    }
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader>
            <DrawerTitle>
              {isEditing ? "Edytuj produkt" : "Dodaj nowy produkt"}
            </DrawerTitle>
            <DrawerDescription>
              {isEditing ? "Zaktualizuj dane produktu" : "Wypełnij dane nowego produktu"}
            </DrawerDescription>
          </DrawerHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 max-h-[60vh] overflow-y-auto">
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nazwa produktu*</FormLabel>
                    <FormControl>
                      <Input placeholder="Np. Ćwiartka z kurczaka kl. A" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU / Indeks</FormLabel>
                      <FormControl>
                        <Input placeholder="Np. KUR-CW-A" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jednostka miary</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="szt">szt</SelectItem>
                          <SelectItem value="l">l</SelectItem>
                          <SelectItem value="opak">opak</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="industry_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategoria branżowa</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Wybierz kategorię" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INDUSTRY_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.icon} {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Określa typ produktu w procesie produkcyjnym
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_raw_material"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Surowiec</FormLabel>
                      <FormDescription>
                        Czy to surowiec do produkcji?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_expiration_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domyślna ważność (dni)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="Np. 14" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="min_storage_temp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Min. temp. (°C)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="0.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_storage_temp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max. temp. (°C)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="4.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DrawerFooter className="px-0">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Zapisywanie..." : isEditing ? "Zapisz zmiany" : "Dodaj produkt"}
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