import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeams } from "@/hooks/use-teams";
import { VISIBILITY_OPTIONS } from "@shared/schema";
import type { UseFormReturn } from "react-hook-form";

const VISIBILITY_LABELS: Record<string, string> = {
  private: "Private (Only me)",
  team: "My Team",
  all_tenants: "All Tenants",
  public: "Public",
};

interface TeamVisibilityFieldsProps {
  form: UseFormReturn<any>;
  teamFieldName?: string;
  visibilityFieldName?: string;
}

export function TeamVisibilityFields({ form, teamFieldName = "teamId", visibilityFieldName = "visibility" }: TeamVisibilityFieldsProps) {
  const { data: teams } = useTeams();

  return (
    <>
      <FormField
        control={form.control}
        name={teamFieldName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Team</FormLabel>
            <Select
              value={field.value ? String(field.value) : "none"}
              onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}
            >
              <FormControl>
                <SelectTrigger className="rounded-xl" data-testid="select-team">
                  <SelectValue placeholder="No team" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">No team</SelectItem>
                {teams?.map(team => (
                  <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={visibilityFieldName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Visibility</FormLabel>
            <Select value={field.value || "all_tenants"} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="rounded-xl" data-testid="select-visibility">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {VISIBILITY_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>{VISIBILITY_LABELS[opt]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export function VisibilityBadge({ visibility }: { visibility: string }) {
  const colors: Record<string, string> = {
    private: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    team: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    all_tenants: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    public: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[visibility] || colors.public}`} data-testid={`badge-visibility-${visibility}`}>
      {VISIBILITY_LABELS[visibility] || visibility}
    </span>
  );
}
