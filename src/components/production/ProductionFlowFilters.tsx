import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Filter, X } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useFacilities } from "@/hooks/useFacilities";
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

const PRESET_RANGES = [
  { label: "Dzisiaj", getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: "Ostatnie 7 dni", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Ostatnie 30 dni", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "Ten miesiąc", getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
];

export function ProductionFlowFilters({ filters, onFiltersChange }: ProductionFlowFiltersProps) {
  const { data: facilities } = useFacilities();
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    to: filters.dateTo ? new Date(filters.dateTo) : undefined,
  });

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

  const clearFilters = () => {
    setDateRange({});
    onFiltersChange({});
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.facilityId || filters.orderType;

  return (
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
  );
}
