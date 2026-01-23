import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import { useBatches } from "@/hooks/useBatches";
import { 
  useCreateWarehouseMovement, 
  useCreateMovementItem,
  generateDocumentNumber 
} from "@/hooks/useWarehouseMovements";

const formSchema = z.object({
  company_id: z.string().min(1, "Wybierz firmę"),
  facility_id: z.string().min(1, "Wybierz zakład"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SelectedBatch {
  batch_id: string;
  batch_number: string;
  product_name: string;
  quantity: number;
  transfer_quantity: number;
  unit: string;
}

export default function NewTransferPage() {
  const navigate = useNavigate();
  const [selectedBatches, setSelectedBatches] = useState<SelectedBatch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: companies } = useCompanies();
  const { data: facilities } = useFacilities();
  const { data: batches } = useBatches();
  const createMovement = useCreateWarehouseMovement();
  const createItem = useCreateMovementItem();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_id: "",
      facility_id: "",
      notes: "",
    },
  });

  const selectedCompanyId = form.watch("company_id");
  const filteredFacilities = facilities?.filter(f => f.company_id === selectedCompanyId);

  // Filter batches with available quantity
  const availableBatches = batches?.filter(b => 
    b.current_quantity > 0 && 
    b.status === "Released" &&
    !selectedBatches.find(sb => sb.batch_id === b.id)
  );

  const handleAddBatch = (batch: typeof batches extends (infer T)[] | undefined ? T : never) => {
    if (!batch) return;
    
    setSelectedBatches(prev => [...prev, {
      batch_id: batch.id,
      batch_number: batch.internal_batch_number,
      product_name: batch.product?.name || "Nieznany produkt",
      quantity: batch.current_quantity,
      transfer_quantity: batch.current_quantity,
      unit: batch.product?.unit || "kg",
    }]);
  };

  const handleRemoveBatch = (batchId: string) => {
    setSelectedBatches(prev => prev.filter(b => b.batch_id !== batchId));
  };

  const handleQuantityChange = (batchId: string, quantity: number) => {
    setSelectedBatches(prev => prev.map(b => 
      b.batch_id === batchId 
        ? { ...b, transfer_quantity: Math.min(quantity, b.quantity) }
        : b
    ));
  };

  const handleSubmit = async (data: FormValues) => {
    if (selectedBatches.length === 0) {
      toast.error("Dodaj przynajmniej jedną partię do przesunięcia");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create MM document
      const movement = await createMovement.mutateAsync({
        company_id: data.company_id,
        facility_id: data.facility_id,
        document_number: generateDocumentNumber("MM"),
        type: "MM",
        notes: data.notes,
      });

      // Add items
      for (const batch of selectedBatches) {
        await createItem.mutateAsync({
          movement_id: movement.id,
          product_id: batches?.find(b => b.id === batch.batch_id)?.product_id || "",
          batch_id: batch.batch_id,
          quantity: batch.transfer_quantity,
        });
      }

      toast.success("Przesunięcie MM zostało utworzone");
      navigate("/warehouse/transfers");
    } catch (error) {
      console.error("Error creating transfer:", error);
      toast.error("Błąd podczas tworzenia przesunięcia");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalQuantity = selectedBatches.reduce((sum, b) => sum + b.transfer_quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/warehouse/transfers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nowe Przesunięcie MM</h1>
          <p className="text-muted-foreground">
            Przenieś partie między lokalizacjami
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Form */}
        <Card>
          <CardHeader>
            <CardTitle>Dane dokumentu</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4">
                <FormField
                  control={form.control}
                  name="company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firma</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz firmę" />
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
                      <FormLabel>Zakład docelowy</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value}
                        disabled={!selectedCompanyId}
                      >
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

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Uwagi (opcjonalnie)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="np. Przesunięcie do chłodni A, Kierunek: mroźnia..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Right: Batch selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Dostępne partie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!availableBatches?.length ? (
              <p className="text-muted-foreground text-center py-8">
                Brak dostępnych partii do przesunięcia
              </p>
            ) : (
              <div className="max-h-[300px] overflow-auto space-y-2">
                {availableBatches.map((batch) => (
                  <div 
                    key={batch.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleAddBatch(batch)}
                  >
                    <div>
                      <p className="font-mono text-sm font-medium">{batch.internal_batch_number}</p>
                      <p className="text-sm text-muted-foreground">{batch.product?.name}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary">
                        {batch.current_quantity.toFixed(1)} {batch.product?.unit}
                      </Badge>
                      <Plus className="h-4 w-4 mt-1 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Selected batches */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Partie do przesunięcia</span>
            {selectedBatches.length > 0 && (
              <Badge variant="outline" className="text-lg">
                Razem: {totalQuantity.toFixed(1)} kg
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedBatches.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Kliknij na partię powyżej, aby dodać ją do przesunięcia
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr partii</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Dostępne</TableHead>
                  <TableHead>Do przesunięcia</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedBatches.map((batch) => (
                  <TableRow key={batch.batch_id}>
                    <TableCell className="font-mono">{batch.batch_number}</TableCell>
                    <TableCell>{batch.product_name}</TableCell>
                    <TableCell>{batch.quantity.toFixed(1)} {batch.unit}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max={batch.quantity}
                        value={batch.transfer_quantity}
                        onChange={(e) => handleQuantityChange(batch.batch_id, parseFloat(e.target.value) || 0)}
                        className="w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveBatch(batch.batch_id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate("/warehouse/transfers")}>
          Anuluj
        </Button>
        <Button 
          onClick={form.handleSubmit(handleSubmit)}
          disabled={isSubmitting || selectedBatches.length === 0}
        >
          {isSubmitting ? "Tworzenie..." : "Utwórz przesunięcie MM"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
