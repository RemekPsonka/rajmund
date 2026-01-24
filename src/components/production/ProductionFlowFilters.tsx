import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar as CalendarIcon, Filter, X, FileText, Check } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useFacilities } from "@/hooks/useFacilities";
import { useProductionOrders } from "@/hooks/useProductionOrders";
import { Badge } from "@/components/ui/badge";
import type { FlowFilters } from "@/hooks/useProductionFlow";

interface ProductionFlowFiltersProps {
  filters: FlowFilters;
  onFiltersChange: (filters: FlowFilters) => void;
}

const ORDER_TYPES = [
  { value: "all", label: "Wszystkie typy" },
  { value: "Decomposition", label: "Rozbór" },
  { value: "Processing", label: "Przetwórstwo" },
  { value: "Packing", label: "Pakowanie" },
];

const ORDER_TYPE_LABELS: Record<string, string> = {
  Decomposition: "Rozbór",
  Processing: "Przetwórstwo",
  Packing: "Pakowanie",
  Assembly: "Składanie Kebaba",
  Freezing: "Mrożenie",
};

const PRESET_RANGES = [
  { label: "Dzisiaj", getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: "Ostatnie 7 dni", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Ostatnie 30 dni", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "Ten miesiąc", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
];

export function ProductionFlowFilters({ filters, onFiltersChange }: ProductionFlowFiltersProps) {
  const { data: facilities } = useFacilities();
  const { data: orders } = useProductionOrders();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    to: filters.dateTo ? new Date(filters.dateTo) : undefined,
  });
  const [orderSearchOpen, setOrderSearchOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");

  // Filter orders for search
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const search = orderSearch.toLowerCase();
    return orders
      .filter(o => 
        o.order_number.toLowerCase().includes(search) ||
        (o.type && ORDER_TYPE_LABELS[o.type]?.toLowerCase().includes(search))
      )
      .slice(0, 20); // Limit to 20 results
  }, [orders, orderSearch]);

  // Get selected order info
  const selectedOrder = useMemo(() => {
    if (!filters.orderId || !orders) return null;
    return orders.find(o => o.id === filters.orderId);
  }, [filters.orderId, orders]);

  const handleDateSelect = (range: { from?: Date; to?: Date }) => {
    setDateRange(range);
    onFiltersChange({
      ...filters,
      dateFrom: range.from ? format(range.from, "yyyy-MM-dd") : undefined,
      dateTo: range.to ? format(range.to, "yyyy-MM-dd") : undefined,
    });
  };

  const handlePresetClick = (preset: typeof PRESET_RANGES[0]) => {
    const range = preset.getValue();
    handleDateSelect(range);
  };

  const handleFacilityChange = (value: string) => {
    onFiltersChange({
      ...filters,
      facilityId: value === "all" ? undefined : value,
    });
  };

  const handleOrderTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      orderType: value === "all" ? undefined : value,
    });
  };

  const handleOrderSelect = (orderId: string) => {
    const order = orders?.find(o => o.id === orderId);
    if (order) {
      onFiltersChange({
        ...filters,
        orderId,
        // Auto-set related filters based on selected order
        orderType: order.type || undefined,
        facilityId: order.facility_id || undefined,
        dateFrom: order.production_date || undefined,
        dateTo: order.production_date || undefined,
      });
      if (order.production_date) {
        setDateRange({
          from: new Date(order.production_date),
          to: new Date(order.production_date),
        });
      }
    }
    setOrderSearchOpen(false);
    setOrderSearch("");
  };

  const clearOrderSelection = () => {
    onFiltersChange({
      ...filters,
      orderId: undefined,
    });
  };

  const clearFilters = () => {
    setDateRange({});
    onFiltersChange({});
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.facilityId || filters.orderType || filters.orderId;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal min-w-[240px]",
                !dateRange.from && "text-muted-foreground"
              )}
              disabled={!!filters.orderId}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "d MMM", { locale: pl })} -{" "}
                    {format(dateRange.to, "d MMM yyyy", { locale: pl })}
                  </>
                ) : (
                  format(dateRange.from, "d MMM yyyy", { locale: pl })
                )
              ) : (
                "Wybierz zakres dat"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              <div className="border-r p-2 space-y-1">
                {PRESET_RANGES.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => handleDateSelect({ from: range?.from, to: range?.to })}
                numberOfMonths={2}
                locale={pl}
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* Facility Select */}
        <Select
          value={filters.facilityId || "all"}
          onValueChange={handleFacilityChange}
          disabled={!!filters.orderId}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Zakład" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie zakłady</SelectItem>
            {facilities?.map((facility) => (
              <SelectItem key={facility.id} value={facility.id}>
                {facility.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Order Type Select */}
        <Select
          value={filters.orderType || "all"}
          onValueChange={handleOrderTypeChange}
          disabled={!!filters.orderId}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Typ zlecenia" />
          </SelectTrigger>
          <SelectContent>
            {ORDER_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Order Search Combobox */}
        <Popover open={orderSearchOpen} onOpenChange={setOrderSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={orderSearchOpen}
              className={cn(
                "w-[280px] justify-between",
                filters.orderId && "border-primary"
              )}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {selectedOrder ? selectedOrder.order_number : "Wybierz zlecenie..."}
                </span>
              </div>
              {selectedOrder && (
                <Badge variant="outline" className="ml-2 shrink-0">
                  {ORDER_TYPE_LABELS[selectedOrder.type || ""] || selectedOrder.type}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Szukaj zlecenia po numerze..."
                value={orderSearch}
                onValueChange={setOrderSearch}
              />
              <CommandList>
                <CommandEmpty>Nie znaleziono zleceń</CommandEmpty>
                <CommandGroup heading="Ostatnie zlecenia">
                  {filteredOrders.map((order) => (
                    <CommandItem
                      key={order.id}
                      value={order.order_number}
                      onSelect={() => handleOrderSelect(order.id)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Check
                          className={cn(
                            "h-4 w-4",
                            filters.orderId === order.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-mono">{order.order_number}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {ORDER_TYPE_LABELS[order.type || ""] || order.type}
                        </Badge>
                        {order.production_date && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(order.production_date), "d.MM", { locale: pl })}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Wyczyść filtry
          </Button>
        )}
      </div>

      {/* Selected Order Badge */}
      {selectedOrder && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Analiza zlecenia:</span>
          <Badge variant="secondary" className="gap-1">
            <FileText className="h-3 w-3" />
            {selectedOrder.order_number}
            <button
              onClick={clearOrderSelection}
              className="ml-1 hover:bg-muted rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0"
            onClick={clearOrderSelection}
          >
            Pokaż wszystkie zlecenia
          </Button>
        </div>
      )}
    </div>
  );
}
