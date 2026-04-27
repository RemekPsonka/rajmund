import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon, Plus, X, Package, ClipboardList, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCompanies } from "@/hooks/useCompanies";
import { useFacilities } from "@/hooks/useFacilities";
import { useBatches } from "@/hooks/useBatches";
import { useCreateProductionOrder, generateOrderNumber, ProductionOrderType } from "@/hooks/useProductionOrders";
import { useCreateProductionTasks, PREDEFINED_TASKS } from "@/hooks/useProductionTasks";
import { toast } from "sonner";

const orderTypes = [
  { value: "Decomposition", label: "Rozbiór" },
  { value: "Processing", label: "Przetwórstwo" },
  { value: "Packing", label: "Pakowanie" },
] as const;

type OrderType = (typeof orderTypes)[number]["value"];

const formSchema = z.object({
  company_id: z.string().min(1, "Wybierz spółkę"),
  facility_id: z.string().min(1, "Wybierz zakład"),
  type: z.enum(["Decomposition", "Processing", "Packing"]),
  production_date: z.date(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SelectedBatch {
  id: string;
  internal_batch_number: string;
  product_name: string;
  available_quantity: number;
  planned_quantity: number;
}

interface ProductionOrderDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ProductionOrderDialog({ open, onClose }: ProductionOrderDialogProps) {
  const [selectedBatches, setSelectedBatches] = useState<SelectedBatch[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [customTask, setCustomTask] = useState("");
  const [customTasks, setCustomTasks] = useState<string[]>([]);

  const { data: companies } = useCompanies();
  const { data: facilities } = useFacilities();
  const { data: batches } = useBatches({ availableOnly: true });
  const createOrder = useCreateProductionOrder();
  const createTasks = useCreateProductionTasks();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "Decomposition",
      production_date: new Date(),
      notes: "",
    },
  });

  const watchedType = form.watch("type");
  const watchedCompanyId = form.watch("company_id");
  const watchedFacilityId = form.watch("facility_id");

  // Filter facilities by selected company
  const filteredFacilities = facilities?.filter(
    (f) => f.company_id === watchedCompanyId
  );

  // Filter batches by selected facility and status
  const availableBatches = batches?.filter(
    (b) => b.status === "Released" && b.current_quantity > 0
  );

  // Get predefined tasks for selected type
  const predefinedTasksForType = PREDEFINED_TASKS[watchedType] || [];

  // Reset tasks when type changes
  useEffect(() => {
    setSelectedTasks([]);
  }, [watchedType]);

  // Reset facility when company changes
  useEffect(() => {
    form.setValue("facility_id", "");
  }, [watchedCompanyId, form]);

  const handleAddBatch = (batchId: string) => {
    const batch = availableBatches?.find((b) => b.id === batchId);
    if (!batch || selectedBatches.some((sb) => sb.id === batchId)) return;

    setSelectedBatches((prev) => [
      ...prev,
      {
        id: batch.id,
        internal_batch_number: batch.internal_batch_number,
        product_name: batch.product?.name || "Nieznany produkt",
        available_quantity: batch.current_quantity,
        planned_quantity: batch.current_quantity,
      },
    ]);
  };

  const handleRemoveBatch = (batchId: string) => {
    setSelectedBatches((prev) => prev.filter((b) => b.id !== batchId));
  };

  const handleBatchQuantityChange = (batchId: string, quantity: number) => {
    setSelectedBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? { ...b, planned_quantity: Math.min(quantity, b.available_quantity) }
          : b
      )
    );
  };

  const handleToggleTask = (taskName: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskName)
        ? prev.filter((t) => t !== taskName)
        : [...prev, taskName]
    );
  };

  const handleAddCustomTask = () => {
    if (customTask.trim() && !customTasks.includes(customTask.trim())) {
      setCustomTasks((prev) => [...prev, customTask.trim()]);
      setSelectedTasks((prev) => [...prev, customTask.trim()]);
      setCustomTask("");
    }
  };

  const handleRemoveCustomTask = (task: string) => {
    setCustomTasks((prev) => prev.filter((t) => t !== task));
    setSelectedTasks((prev) => prev.filter((t) => t !== task));
  };

  const totalPlannedWeight = selectedBatches.reduce(
    (sum, b) => sum + b.planned_quantity,
    0
  );

  const onSubmit = async (values: FormValues) => {
    try {
      // Generate order number
      const orderNumber = generateOrderNumber(values.type as ProductionOrderType);
      
      // Create the production order
      const order = await createOrder.mutateAsync({
        company_id: values.company_id,
        facility_id: values.facility_id,
        order_number: orderNumber,
        type: values.type,
        production_date: format(values.production_date, "yyyy-MM-dd"),
        notes: values.notes,
      });

      // Create tasks if any selected
      const allTasks = [...selectedTasks];
      if (allTasks.length > 0) {
        await createTasks.mutateAsync(
          allTasks.map((name, idx) => ({
            production_order_id: order.id,
            name,
            sequence_number: idx + 1,
          }))
        );
      }

      // TODO: Create production inputs from selected batches
      // This would require useCreateProductionInput hook

      toast.success(`Zlecenie ${order.order_number} utworzone`);
      handleClose();
    } catch (error) {
      // Error is handled by mutation
    }
  };

  const handleClose = () => {
    form.reset();
    setSelectedBatches([]);
    setSelectedTasks([]);
    setCustomTasks([]);
    setCustomTask("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nowe zlecenie produkcyjne</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Data Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Dane podstawowe
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="company_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Spółka *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz spółkę" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.short_name || c.name}
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
                        <FormLabel>Zakład *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!watchedCompanyId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Wybierz zakład" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredFacilities?.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Typ zlecenia *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {orderTypes.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
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
                        <FormLabel>Data produkcji *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd.MM.yyyy", { locale: pl })
                                ) : (
                                  <span>Wybierz datę</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              locale={pl}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Planned Input Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Planowany wsad (RW)
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Wybierz partie surowców do przetworzenia
                </p>

                {/* Batch selector */}
                <Select onValueChange={handleAddBatch} value="">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="+ Dodaj partię" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBatches
                      ?.filter((b) => !selectedBatches.some((sb) => sb.id === b.id))
                      .map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.internal_batch_number} • {b.product?.name} •{" "}
                          {b.current_quantity.toFixed(2)} kg
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                {/* Selected batches */}
                {selectedBatches.length > 0 ? (
                  <div className="space-y-2 rounded-lg border p-3">
                    {selectedBatches.map((batch) => (
                      <div
                        key={batch.id}
                        className="flex items-center justify-between gap-4 py-2 border-b last:border-b-0"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {batch.internal_batch_number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {batch.product_name} • dostępne:{" "}
                            {batch.available_quantity.toFixed(2)} kg
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="w-24 text-right"
                            value={batch.planned_quantity}
                            onChange={(e) =>
                              handleBatchQuantityChange(
                                batch.id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            min={0}
                            max={batch.available_quantity}
                            step={0.01}
                          />
                          <span className="text-sm text-muted-foreground">kg</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveBatch(batch.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 flex justify-between text-sm font-medium">
                      <span>Suma planowanego wsadu:</span>
                      <span>{totalPlannedWeight.toFixed(2)} kg</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    Nie wybrano żadnych partii
                  </div>
                )}
              </div>

              <Separator />

              {/* Tasks Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Czynności do wykonania
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Wybierz operacje produkcyjne dla tego zlecenia
                </p>

                <div className="space-y-2">
                  {predefinedTasksForType.map((task) => (
                    <div key={task} className="flex items-center space-x-2">
                      <Checkbox
                        id={task}
                        checked={selectedTasks.includes(task)}
                        onCheckedChange={() => handleToggleTask(task)}
                      />
                      <label
                        htmlFor={task}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {task}
                      </label>
                    </div>
                  ))}

                  {/* Custom tasks */}
                  {customTasks.map((task) => (
                    <div key={task} className="flex items-center space-x-2">
                      <Checkbox
                        id={task}
                        checked={selectedTasks.includes(task)}
                        onCheckedChange={() => handleToggleTask(task)}
                      />
                      <label
                        htmlFor={task}
                        className="text-sm font-medium leading-none cursor-pointer flex-1"
                      >
                        {task}
                      </label>
                      <Badge variant="secondary" className="text-xs">
                        Własna
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRemoveCustomTask(task)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  {/* Add custom task */}
                  <div className="flex gap-2 pt-2">
                    <Input
                      placeholder="Dodaj własną czynność..."
                      value={customTask}
                      onChange={(e) => setCustomTask(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomTask();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleAddCustomTask}
                      disabled={!customTask.trim()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {selectedTasks.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Wybrano {selectedTasks.length} czynności
                  </div>
                )}
              </div>

              <Separator />

              {/* Notes Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Notatki
                </h3>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Opcjonalne uwagi do zlecenia..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

            </form>
          </Form>
        </ScrollArea>

        {/* Footer - zawsze widoczny */}
        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={handleClose}>
            Anuluj
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={createOrder.isPending || createTasks.isPending}
          >
            {(createOrder.isPending || createTasks.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Utwórz zlecenie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
