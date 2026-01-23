import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { useContractors } from "@/hooks/useContractors";
import { useCreatePackagingTransaction } from "@/hooks/usePackaging";

const PACKAGING_TYPES = ["E2", "H1", "Paleta EUR", "Kosz", "Karton"];

const transactionSchema = z.object({
  type: z.enum(["Issued", "Received"]),
  contractor_id: z.string().min(1, "Wybierz kontrahenta"),
  packaging_type: z.string().min(1, "Wybierz typ opakowania"),
  quantity: z.coerce.number().min(1, "Ilość musi być większa od 0"),
  transaction_date: z.date().optional(),
  comments: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface PackagingTransactionDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PackagingTransactionDialog({
  open,
  onClose,
}: PackagingTransactionDialogProps) {
  const { data: contractors, isLoading: contractorsLoading } = useContractors();
  const createTransaction = useCreatePackagingTransaction();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "Received",
      quantity: 1,
      transaction_date: new Date(),
      comments: "",
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = async (values: TransactionFormValues) => {
    const contractor = contractors?.find((c) => c.id === values.contractor_id);
    if (!contractor) return;

    await createTransaction.mutateAsync({
      company_id: contractor.company_id,
      contractor_id: values.contractor_id,
      type: values.type,
      packaging_type: values.packaging_type,
      quantity: values.quantity,
      comments: values.comments || undefined,
    });

    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nowa transakcja opakowań</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Transaction Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ transakcji</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Received" id="received" />
                        <Label htmlFor="received" className="cursor-pointer">
                          Przyjęcie od kontrahenta
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Issued" id="issued" />
                        <Label htmlFor="issued" className="cursor-pointer">
                          Wydanie kontrahentowi
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contractor */}
            <FormField
              control={form.control}
              name="contractor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontrahent</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={contractorsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz kontrahenta..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {contractors?.map((contractor) => (
                        <SelectItem key={contractor.id} value={contractor.id}>
                          {contractor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Packaging Type */}
            <FormField
              control={form.control}
              name="packaging_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ opakowania</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz typ opakowania..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PACKAGING_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quantity */}
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ilość</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Wpisz ilość..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Transaction Date */}
            <FormField
              control={form.control}
              name="transaction_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data transakcji</FormLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
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
                            format(field.value, "d MMMM yyyy", { locale: pl })
                          ) : (
                            <span>Wybierz datę...</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                          field.onChange(date);
                          setCalendarOpen(false);
                        }}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Comments */}
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Komentarz (opcjonalnie)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Dodaj komentarz..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Anuluj
              </Button>
              <Button type="submit" disabled={createTransaction.isPending}>
                {createTransaction.isPending ? "Zapisuję..." : "Zapisz"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
