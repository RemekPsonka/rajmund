import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Truck, Package, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useContractors } from "@/hooks/useContractors";
import { useFacilities } from "@/hooks/useFacilities";
import { useProducts } from "@/hooks/useProducts";
import { useCompanies } from "@/hooks/useCompanies";
import {
  useCreateWarehouseMovement,
  useCreateMovementItem,
  generateDocumentNumber,
} from "@/hooks/useWarehouseMovements";
import { useCreateBatch, generateInternalBatchNumber } from "@/hooks/useBatches";

// Step 1 Schema
const step1Schema = z.object({
  company_id: z.string().min(1, "Wybierz spółkę"),
  contractor_id: z.string().min(1, "Wybierz dostawcę"),
  facility_id: z.string().min(1, "Wybierz magazyn"),
  external_doc_number: z.string().min(1, "Podaj numer HDI"),
  reception_temp: z.coerce.number().optional(),
  driver_name: z.string().optional(),
  car_plates: z.string().optional(),
});

type Step1FormValues = z.infer<typeof step1Schema>;

// Item Schema
const itemSchema = z.object({
  product_id: z.string().min(1, "Wybierz produkt"),
  quantity: z.coerce.number().min(0.01, "Podaj ilość"),
  supplier_batch_number: z.string().optional(),
  production_date: z.string().optional(),
  expiration_date: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

interface DeliveryItem extends ItemFormValues {
  id: string;
  productName: string;
  productUnit: string;
  internalBatchNumber: string;
}

export default function NewDeliveryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [step1Data, setStep1Data] = useState<Step1FormValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: companies } = useCompanies();
  const { data: contractors } = useContractors(undefined, { suppliersOnly: true });
  const { data: facilities } = useFacilities();
  const { data: products } = useProducts();

  const createMovement = useCreateWarehouseMovement();
  const createMovementItem = useCreateMovementItem();
  const createBatch = useCreateBatch();

  // Step 1 Form
  const step1Form = useForm<Step1FormValues>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      company_id: "",
      contractor_id: "",
      facility_id: "",
      external_doc_number: "",
      reception_temp: undefined,
      driver_name: "",
      car_plates: "",
    },
  });

  // Item Form
  const itemForm = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      product_id: "",
      quantity: undefined,
      supplier_batch_number: "",
      production_date: "",
      expiration_date: "",
    },
  });

  const selectedCompanyId = step1Form.watch("company_id");
  const filteredFacilities = facilities?.filter((f) => f.company_id === selectedCompanyId);
  const filteredContractors = contractors?.filter((c) => c.company_id === selectedCompanyId);
  const filteredProducts = products?.filter((p) => p.company_id === selectedCompanyId);

  const handleStep1Submit = (data: Step1FormValues) => {
    setStep1Data(data);
    setStep(2);
  };

  const handleAddItem = (data: ItemFormValues) => {
    const product = products?.find((p) => p.id === data.product_id);
    if (!product || !step1Data) return;

    const internalBatchNumber = generateInternalBatchNumber(
      step1Data.contractor_id,
      items.length + 1
    );

    const newItem: DeliveryItem = {
      ...data,
      id: crypto.randomUUID(),
      productName: product.name,
      productUnit: product.unit,
      internalBatchNumber,
    };

    setItems((prev) => [...prev, newItem]);
    itemForm.reset();
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async () => {
    if (!step1Data || items.length === 0) return;

    setIsSubmitting(true);
    try {
      // 1. Create movement document
      const documentNumber = generateDocumentNumber("PZ");
      const movement = await createMovement.mutateAsync({
        company_id: step1Data.company_id,
        document_number: documentNumber,
        type: "PZ",
        contractor_id: step1Data.contractor_id,
        facility_id: step1Data.facility_id,
        external_doc_number: step1Data.external_doc_number,
        reception_temp: step1Data.reception_temp,
        driver_name: step1Data.driver_name,
        car_plates: step1Data.car_plates,
      });

      // 2. Create batches and movement items
      for (const item of items) {
        // Create batch
        const batch = await createBatch.mutateAsync({
          product_id: item.product_id,
          internal_batch_number: item.internalBatchNumber,
          supplier_batch_number: item.supplier_batch_number,
          supplier_id: step1Data.contractor_id,
          production_date: item.production_date || undefined,
          expiration_date: item.expiration_date || undefined,
          initial_quantity: item.quantity,
          current_quantity: item.quantity,
        });

        // Create movement item
        await createMovementItem.mutateAsync({
          movement_id: movement.id,
          product_id: item.product_id,
          batch_id: batch.id,
          quantity: item.quantity,
        });
      }

      toast.success(`Dokument ${documentNumber} został utworzony`);
      navigate("/warehouse/deliveries");
    } catch (error) {
      console.error(error);
      toast.error("Wystąpił błąd podczas zapisywania");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Nowa Dostawa (PZ)</h1>
          <p className="text-muted-foreground">Przyjęcie zewnętrzne towaru</p>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step >= 1 ? "border-primary bg-primary text-primary-foreground" : "border-muted"}`}>
            {step > 1 ? <Check className="h-4 w-4" /> : "1"}
          </div>
          <span className="font-medium">Nagłówek</span>
        </div>
        <div className="h-px flex-1 bg-border" />
        <div className={`flex items-center gap-2 ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>
          <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${step >= 2 ? "border-primary bg-primary text-primary-foreground" : "border-muted"}`}>
            {step > 2 ? <Check className="h-4 w-4" /> : "2"}
          </div>
          <span className="font-medium">Pozycje</span>
        </div>
      </div>

      {/* Step 1: Header */}
      {step === 1 && (
        <Card className="shadow-industrial">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Dane dostawy
            </CardTitle>
            <CardDescription>
              Wprowadź dane nagłówka dokumentu PZ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...step1Form}>
              <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-6">
                <FormField
                  control={step1Form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Spółka*</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base">
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

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={step1Form.control}
                    name="contractor_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dostawca*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCompanyId}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base">
                              <SelectValue placeholder="Wybierz dostawcę" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredContractors?.map((contractor) => (
                              <SelectItem key={contractor.id} value={contractor.id}>
                                {contractor.name}
                                {contractor.vet_number && ` (WNI: ${contractor.vet_number})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="facility_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Magazyn docelowy*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCompanyId}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base">
                              <SelectValue placeholder="Wybierz magazyn" />
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
                </div>

                <Separator />

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={step1Form.control}
                    name="external_doc_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Numer HDI dostawcy*</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" placeholder="Np. HDI/2026/001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="reception_temp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temperatura przyjęcia (°C)</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" type="number" step="0.1" placeholder="Np. 2.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <FormField
                    control={step1Form.control}
                    name="driver_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kierowca</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" placeholder="Imię i nazwisko" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={step1Form.control}
                    name="car_plates"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nr rejestracyjny</FormLabel>
                        <FormControl>
                          <Input className="h-12 text-base" placeholder="Np. SK 12345" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="lg" className="gap-2">
                    Dalej
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Items */}
      {step === 2 && step1Data && (
        <>
          {/* Summary of Step 1 */}
          <Card className="shadow-industrial bg-muted/30">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <Badge variant="outline" className="gap-1">
                  <Truck className="h-3 w-3" />
                  {contractors?.find((c) => c.id === step1Data.contractor_id)?.name}
                </Badge>
                <Badge variant="outline">HDI: {step1Data.external_doc_number}</Badge>
                {step1Data.reception_temp && (
                  <Badge variant="outline">Temp: {step1Data.reception_temp}°C</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Item Form */}
          <Card className="shadow-industrial">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Dodaj pozycję
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...itemForm}>
                <form onSubmit={itemForm.handleSubmit(handleAddItem)} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <FormField
                      control={itemForm.control}
                      name="product_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Produkt*</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-12">
                                <SelectValue placeholder="Wybierz produkt" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredProducts?.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name} ({product.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ilość (kg)*</FormLabel>
                          <FormControl>
                            <Input className="h-12 text-lg font-medium" type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="production_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data uboju</FormLabel>
                          <FormControl>
                            <Input className="h-12" type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="expiration_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data ważności</FormLabel>
                          <FormControl>
                            <Input className="h-12" type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={itemForm.control}
                    name="supplier_batch_number"
                    render={({ field }) => (
                      <FormItem className="max-w-md">
                        <FormLabel>Nr partii dostawcy</FormLabel>
                        <FormControl>
                          <Input className="h-12" placeholder="Opcjonalnie" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" variant="secondary" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Dodaj pozycję
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Items Table */}
          {items.length > 0 && (
            <Card className="shadow-industrial">
              <CardHeader>
                <CardTitle>Pozycje dostawy ({items.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nr partii wewnętrzny</TableHead>
                      <TableHead>Produkt</TableHead>
                      <TableHead className="text-right">Ilość</TableHead>
                      <TableHead>Data uboju</TableHead>
                      <TableHead>Data ważności</TableHead>
                      <TableHead>Nr partii dostawcy</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <code className="bg-primary/10 text-primary px-2 py-1 rounded font-medium">
                            {item.internalBatchNumber}
                          </code>
                        </TableCell>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity.toFixed(2)} {item.productUnit}
                        </TableCell>
                        <TableCell>{item.production_date || "—"}</TableCell>
                        <TableCell>{item.expiration_date || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.supplier_batch_number || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Wstecz
            </Button>
            <Button
              size="lg"
              disabled={items.length === 0 || isSubmitting}
              onClick={handleSubmit}
              className="gap-2"
            >
              {isSubmitting ? "Zapisywanie..." : "Zatwierdź PZ"}
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}