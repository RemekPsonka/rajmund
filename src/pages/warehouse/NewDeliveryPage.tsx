import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, ArrowRight, Plus, Trash2, Package, Boxes, Truck, Check, MapPin, Thermometer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { useCompanies } from "@/hooks/useCompanies";
import { useContractors } from "@/hooks/useContractors";
import { useFacilities } from "@/hooks/useFacilities";
import { useProducts } from "@/hooks/useProducts";
import { useStorageLocations, getLocationTypeLabel, LocationType } from "@/hooks/useStorageLocations";
import { useCreateWarehouseMovement, useCreateMovementItem } from "@/hooks/useWarehouseMovements";
import { useCreateBatch, generateInternalBatchNumber } from "@/hooks/useBatches";
import { useCreatePackagingTransaction } from "@/hooks/usePackaging";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Step 1: Delivery header
const step1Schema = z.object({
  company_id: z.string().min(1, "Wybierz spółkę"),
  facility_id: z.string().min(1, "Wybierz zakład"),
  contractor_id: z.string().min(1, "Wybierz dostawcę"),
  external_doc_number: z.string().optional(),
  driver_name: z.string().optional(),
  car_plates: z.string().optional(),
  received_temp_c: z.preprocess(
    (val) => (val === "" || val === undefined || val === null ? undefined : Number(val)),
    z.number({ required_error: "Pomiar temperatury jest wymagany" })
      .min(-30, "Min -30°C")
      .max(30, "Max 30°C")
  ),
  received_temp_method: z.enum(["VEHICLE_GAUGE", "MANUAL_PROBE", "BOTH"], {
    required_error: "Wybierz metodę pomiaru",
  }),
  notes: z.string().optional(),
});

type Step1FormValues = z.infer<typeof step1Schema>;

// Step 2: Item form with validation
const supplierBatchRegex = /^[a-zA-Z0-9\-_.\/]+$/;

const itemSchema = z.object({
  product_id: z.string().min(1, "Wybierz produkt"),
  quantity: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().min(0.01, "Podaj ilość")
  ),
  supplier_batch_number: z.string()
    .max(50, "Numer partii max 50 znaków")
    .refine(
      (val) => !val || supplierBatchRegex.test(val),
      "Dozwolone: litery, cyfry, myślniki, podkreślenia, kropki, ukośniki"
    )
    .optional(),
  production_date: z.string().optional(),
  expiration_date: z.string().optional(),
  location_id: z.string().optional(),
});

type ItemFormValues = z.infer<typeof itemSchema>;

interface DeliveryItem extends ItemFormValues {
  id: string;
  productName: string;
  productUnit: string;
  internalBatchNumber: string;
  locationName?: string;
}

interface PackagingItem {
  id: string;
  packaging_type: string;
  quantity: number;
}

const PACKAGING_TYPES = [
  { value: "Paleta EUR", label: "Paleta EUR" },
  { value: "E2", label: "Pojemnik E2" },
  { value: "Karton", label: "Karton" },
];

export default function NewDeliveryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [step1Data, setStep1Data] = useState<Step1FormValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCcp1Warning, setShowCcp1Warning] = useState(false);

  // Packaging form state
  const [newPackagingType, setNewPackagingType] = useState("");
  const [newPackagingQty, setNewPackagingQty] = useState<number>(0);

  const { data: companies } = useCompanies();
  const { data: contractors } = useContractors(undefined, { suppliersOnly: true });
  const { data: facilities } = useFacilities();
  const { data: products } = useProducts();

  const createMovement = useCreateWarehouseMovement();
  const createMovementItem = useCreateMovementItem();
  const createBatch = useCreateBatch();
  const createPackagingTransaction = useCreatePackagingTransaction();

  // Step 1 Form
  const step1Form = useForm<Step1FormValues>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      company_id: "",
      contractor_id: "",
      facility_id: "",
      external_doc_number: "",
      received_temp_c: undefined,
      received_temp_method: undefined,
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
      location_id: "",
    },
  });

  const selectedCompanyId = step1Form.watch("company_id");
  const selectedFacilityId = step1Form.watch("facility_id");
  const filteredFacilities = facilities?.filter((f) => f.company_id === selectedCompanyId);
  const filteredContractors = contractors?.filter((c) => c.company_id === selectedCompanyId);
  const filteredProducts = products?.filter((p) => p.company_id === selectedCompanyId);

  // Fetch storage locations for selected facility
  const { data: storageLocations } = useStorageLocations(step1Data?.facility_id || selectedFacilityId);

  const handleStep1Submit = (data: Step1FormValues) => {
    setStep1Data(data);
    setStep(2);
  };

  const handleAddItem = (data: ItemFormValues) => {
    const product = products?.find((p) => p.id === data.product_id);
    const location = storageLocations?.find((l) => l.id === data.location_id);
    if (!product || !step1Data) return;

    const internalBatchNumber = generateInternalBatchNumber(
      step1Data.contractor_id,
      items.length + 1
    );

    const newItem: DeliveryItem = {
      ...data,
      id: crypto.randomUUID(),
      productName: product.name,
      productUnit: product.unit || "kg",
      internalBatchNumber,
      locationName: location?.name,
    };

    setItems((prev) => [...prev, newItem]);
    itemForm.reset();
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddPackaging = () => {
    if (!newPackagingType || newPackagingQty <= 0) return;
    
    setPackagingItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        packaging_type: newPackagingType,
        quantity: newPackagingQty,
      },
    ]);
    setNewPackagingType("");
    setNewPackagingQty(0);
  };

  const handleRemovePackaging = (id: string) => {
    setPackagingItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSubmit = async () => {
    if (!step1Data || items.length === 0) return;

    setIsSubmitting(true);
    try {
      // 1. Generate document number via RPC
      const { data: docNumber, error: docError } = await supabase.rpc(
        "generate_document_number",
        { p_company_id: step1Data.company_id, p_type: "PZ" }
      );
      if (docError) throw docError;

      // 2. Create movement document
      const movement = await createMovement.mutateAsync({
        company_id: step1Data.company_id,
        document_number: docNumber,
        type: "PZ",
        contractor_id: step1Data.contractor_id,
        facility_id: step1Data.facility_id,
        external_doc_number: step1Data.external_doc_number,
        reception_temp: step1Data.reception_temp,
        driver_name: step1Data.driver_name,
        car_plates: step1Data.car_plates,
      });

      // 3. Create batches and movement items
      for (const item of items) {
        // Create batch with location
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

        // Update batch location if specified
        if (item.location_id) {
          await supabase
            .from("t_batches")
            .update({ location_id: item.location_id })
            .eq("id", batch.id);
        }

        // Create movement item
        await createMovementItem.mutateAsync({
          movement_id: movement.id,
          product_id: item.product_id,
          batch_id: batch.id,
          quantity: item.quantity,
        });
      }

      // 4. Create packaging transactions (received from driver)
      for (const pkg of packagingItems) {
        await createPackagingTransaction.mutateAsync({
          company_id: step1Data.company_id,
          contractor_id: step1Data.contractor_id,
          type: "Received",
          packaging_type: pkg.packaging_type,
          quantity: pkg.quantity,
          comments: `PZ: ${docNumber}`,
        });
      }

      toast.success(`Dokument ${docNumber} został utworzony`);
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
        <Card>
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
                        <FormLabel>Numer HDI dostawcy</FormLabel>
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
                          <Input className="h-12 text-base" type="number" step="0.1" placeholder="Np. 2.5" {...field} value={field.value ?? ""} />
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
          <Card className="bg-muted/30">
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 text-sm">
                <Badge variant="outline" className="gap-1">
                  <Truck className="h-3 w-3" />
                  {contractors?.find((c) => c.id === step1Data.contractor_id)?.name}
                </Badge>
                <Badge variant="outline">HDI: {step1Data.external_doc_number || "—"}</Badge>
                {step1Data.reception_temp && (
                  <Badge variant="outline">Temp: {step1Data.reception_temp}°C</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Item Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Dodaj pozycję
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...itemForm}>
                <form onSubmit={itemForm.handleSubmit(handleAddItem)} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                                  {product.name} ({product.unit || "kg"})
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
                            <Input className="h-12 text-lg font-medium" type="number" step="0.01" placeholder="0.00" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="location_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lokalizacja docelowa</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger className="h-12">
                                <SelectValue placeholder="Wybierz lokalizację" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {storageLocations?.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3" />
                                    {loc.name} ({getLocationTypeLabel(loc.location_type as LocationType)})
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
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

                    <FormField
                      control={itemForm.control}
                      name="supplier_batch_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nr partii dostawcy</FormLabel>
                          <FormControl>
                            <Input className="h-12" placeholder="Opcjonalnie" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
            <Card>
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
                      <TableHead>Lokalizacja</TableHead>
                      <TableHead>Data uboju</TableHead>
                      <TableHead>Data ważności</TableHead>
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
                        <TableCell>
                          {item.locationName ? (
                            <Badge variant="outline" className="gap-1">
                              <MapPin className="h-3 w-3" />
                              {item.locationName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{item.production_date || "—"}</TableCell>
                        <TableCell>{item.expiration_date || "—"}</TableCell>
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

          {/* Packaging from Driver */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-5 w-5" />
                Opakowania od kierowcy
              </CardTitle>
              <CardDescription>
                Wprowadź opakowania zwrotne dostarczone przez kierowcę
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-sm font-medium">Typ opakowania</label>
                  <Select value={newPackagingType} onValueChange={setNewPackagingType}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Wybierz typ" />
                    </SelectTrigger>
                    <SelectContent>
                      {PACKAGING_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32 space-y-2">
                  <label className="text-sm font-medium">Ilość</label>
                  <Input
                    type="number"
                    className="h-12"
                    value={newPackagingQty || ""}
                    onChange={(e) => setNewPackagingQty(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 gap-2"
                  onClick={handleAddPackaging}
                  disabled={!newPackagingType || newPackagingQty <= 0}
                >
                  <Plus className="h-4 w-4" />
                  Dodaj
                </Button>
              </div>

              {packagingItems.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {packagingItems.map((pkg) => (
                    <div key={pkg.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2">
                        <Boxes className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{pkg.packaging_type}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary">{pkg.quantity} szt.</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePackaging(pkg.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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
