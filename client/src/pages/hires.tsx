import { useState } from "react";
import { useHires, useUpdateHire } from "@/hooks/use-hires";
import { useProfile } from "@/hooks/use-profile";
import { format } from "date-fns";
import { Repeat, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function Hires() {
  const { data: hires, isLoading } = useHires();
  const { data: profile } = useProfile();
  const returnMutation = useUpdateHire();
  const { toast } = useToast();

  const canManage = profile?.role === "admin" || profile?.role === "tenant";

  function handleReturn(hireId: number) {
    returnMutation.mutate({ id: hireId, status: "returned" }, {
      onSuccess: () => {
        toast({ title: "Item returned", description: "The hire has been marked as returned." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to return item.", variant: "destructive" });
      },
    });
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight" data-testid="text-hires-title">Active Hires</h1>
        <p className="text-muted-foreground mt-1">Track inventory items currently being borrowed.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : hires?.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border/50">
          <Repeat className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-display text-lg font-medium">No active hires</h3>
          <p className="text-muted-foreground">Items borrowed from the inventory will appear here.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-medium">Item ID</th>
                  <th className="px-6 py-4 font-medium">Borrower</th>
                  <th className="px-6 py-4 font-medium">Borrow Period</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {hires?.map((hire) => (
                  <tr key={hire.id} data-testid={`row-hire-${hire.id}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground" data-testid={`text-hire-item-${hire.id}`}>
                      #{hire.itemId}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {hire.borrowerId.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-foreground">
                        {format(new Date(hire.startTime), "MMM d, yyyy")} - {format(new Date(hire.endTime), "MMM d, yyyy")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span data-testid={`text-hire-status-${hire.id}`} className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        hire.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        hire.status === 'returned' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        <span className="capitalize">{hire.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canManage && hire.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => handleReturn(hire.id)}
                          disabled={returnMutation.isPending}
                          data-testid={`button-return-hire-${hire.id}`}
                        >
                          <CheckCircle size={14} className="mr-1" />
                          Mark Returned
                        </Button>
                      )}
                      {hire.status === 'returned' && (
                        <span className="text-sm text-muted-foreground">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
