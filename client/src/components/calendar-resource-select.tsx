import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCalendarResources } from "@/hooks/use-calendars";
import type { UseFormReturn } from "react-hook-form";

export function CalendarResourceSelect({
  form,
  name = "calendarResourceId",
  label = "Assigned Calendar",
}: {
  form: UseFormReturn<any>;
  name?: string;
  label?: string;
}) {
  const { data: resources } = useCalendarResources();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value ? String(field.value) : "none"}
            onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))}
          >
            <FormControl>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select a calendar" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="none">Select a calendar</SelectItem>
              {resources?.map((resource: any) => (
                <SelectItem key={resource.id} value={String(resource.id)}>
                  {resource.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
