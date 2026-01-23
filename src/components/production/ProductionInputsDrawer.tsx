import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Package, Trash2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

import {
  useProductionOrder,
  useProductionInputs,
  useCreateProductionInput,
} from "@/hooks/useProductionOrders";
import { useBatches } from "@/hooks/useBatches";
import { PROCESSING_DIRECTIONS } from "@/hooks/useStorageLocations";

const inputSchema = z.object({
  batch_id: z.string().min(1, "Wybierz partię"),
  weight: z.coerce.number().min(0.01, "Podaj wagę"),
  direction: z.string().optional(),
});

type InputFormValues = z.infer<typeof inputSchema>;

interface ProductionInputsDrawerProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
}

export const ProductionInputsDrawer = React.forwardRef<HTMLDivElement, ProductionInputsDrawerProps>(
  function ProductionInputsDrawer({ open, onClose, orderId }, ref) {
  const { data: order, isLoading: loadingOrder } = useProductionOrder(orderId || undefined);
  const { data: inputs, isLoading: loadingInputs } = useProductionInputs(orderId || undefined);
  const { data: batches } = useBatches();
  const createInput = useCreateProductionInput();

  // Filter only released batches with stock
  const availableBatches = batches?.filter(
    (b) => b.status === "Released" && b.current_quantity > 0
  );

  const form = useForm<InputFormValues>({
    resolver: zodResolver(inputSchema),
    defaultValues: {
      batch_id: "",
      weight: undefined,
      direction: "",
    },
  });

  const selectedBatchId = form.watch("batch_id");
  const selectedBatch = batches?.find((b) => b.id === selectedBatchId);

  const onSubmit = async (values: InputFormValues) => {
    if (!orderId || !selectedBatch) return;

    try {
      await createInput.mutateAsync({
        production_order_id: orderId,
        batch_id: values.batch_id,
        product_id: selectedBatch.product_id,
        weight: values.weight,
        direction: values.direction || undefined,
      });
      form.reset();
    } catch {
      // Error handled by hook
    }
  };

  const totalInputWeight = inputs?.reduce((sum, input) => sum + input.weight, 0) || 0;

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <div className="mx-auto w-full max-w-2xl overflow-auto">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Wsad do produkcji (RW)
            </DrawerTitle>
            <DrawerDescription>
              {loadingOrder ? (
                <Skeleton className="h-4 w-48" />
              ) : order ? (
                `Zlecenie: ${order.order_number} • ${order.facility?.name}`
              ) : (
                "Wybierz zlecenie"
              )}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 space-y-6 pb-6">
            {/* Add Input Form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Dodaj surowiec</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="batch_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Partia surowca (z magazynu)*</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Wybierz partię" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableBatches?.map((batch) => (
                                <SelectItem key={batch.id} value={batch.id}>
                                  <span className="font-mono">{batch.internal_batch_number}</span>
                                  <span className="text-muted-foreground ml-2">
                                    • {batch.product?.name} • {batch.current_quantity.toFixed(1)} {batch.product?.unit}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedBatch && (
                      <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                        Dostępne: <strong>{selectedBatch.current_quantity.toFixed(2)} {selectedBatch.product?.unit}</strong>
                        {" • "}Produkt: {selectedBatch.product?.name}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="direction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kierunek przetwórstwa</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Wybierz kierunek (opcjonalnie)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PROCESSING_DIRECTIONS.map((dir) => (
                                <SelectItem key={dir.value} value={dir.value}>
                                  {dir.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-4 items-end">
                      <FormField
                        control={form.control}
                        name="weight"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>Waga (kg)*</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={createInput.isPending} className="gap-2">
                        <Plus className="h-4 w-4" />
                        {createInput.isPending ? "Dodawanie..." : "Dodaj"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Separator />

            {/* Inputs List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Wsad ({inputs?.length || 0} pozycji)</h3>
                <span className="text-sm text-muted-foreground">
                  Razem: <strong>{totalInputWeight.toFixed(2)} kg</strong>
                </span>
              </div>

              {loadingInputs ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : inputs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Brak dodanego wsadu</p>
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nr partii</TableHead>
                        <TableHead>Produkt</TableHead>
                        <TableHead>Kierunek</TableHead>
                        <TableHead className="text-right">Waga</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inputs?.map((input) => {
                        const directionLabel = PROCESSING_DIRECTIONS.find(
                          (d) => d.value === input.direction
                        )?.label;
                        return (
                          <TableRow key={input.id}>
                            <TableCell>
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {input.batch?.internal_batch_number}
                              </code>
                            </TableCell>
                            <TableCell>{input.product?.name}</TableCell>
                            <TableCell>
                              {directionLabel ? (
                                <span className="text-sm">{directionLabel}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {input.weight.toFixed(2)} {input.product?.unit}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
});

ProductionInputsDrawer.displayName = "ProductionInputsDrawer";