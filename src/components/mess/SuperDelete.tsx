import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { errMsg } from "@/lib/mess";

export type SuperDeleteEntity = "mess" | "room" | "seat" | "membership" | "reservation" | "bill" | "payment" | "deposit-transaction" | "settlement" | "expense" | "complaint" | "notice";

/**
 * Super Admin-only permanent delete. Renders nothing for anyone else (the
 * backend refuses them too). The operator must type DELETE; the server also
 * requires confirm=DELETE and writes the deleted record to the audit log.
 */
export function SuperDeleteButton({
  entity,
  id,
  what,
  warning,
  onDeleted,
  variant = "icon",
  className,
}: {
  entity: SuperDeleteEntity;
  id: string;
  /** Shown in the dialog, e.g. "বিল MB-2026-00012". */
  what: string;
  /** Extra consequence text (what else is deleted with it). */
  warning?: string;
  onDeleted: () => void | Promise<void>;
  variant?: "icon" | "button" | "menu";
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user?.isSuperAdmin) return null;

  const run = async () => {
    if (typed !== "DELETE" || busy) return;
    setBusy(true);
    try {
      await api.del(`/mess/admin/${entity}/${id}?confirm=DELETE`);
      toast.success(`${what} স্থায়ীভাবে মুছে ফেলা হয়েছে`);
      setOpen(false);
      await onDeleted();
    } catch (err) {
      toast.error(errMsg(err, "মুছে ফেলা যায়নি"));
    } finally {
      setBusy(false);
    }
  };

  const trigger =
    variant === "icon" ? (
      <Button size="sm" variant="outline" className={`text-destructive hover:text-destructive ${className ?? ""}`} title="স্থায়ীভাবে মুছুন (সুপার অ্যাডমিন)" aria-label="স্থায়ীভাবে মুছুন" onClick={(e) => { e.stopPropagation(); setTyped(""); setOpen(true); }}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    ) : variant === "menu" ? (
      <button type="button" className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 ${className ?? ""}`} onClick={(e) => { e.stopPropagation(); setTyped(""); setOpen(true); }}>
        <Trash2 className="h-4 w-4" />স্থায়ীভাবে মুছুন
      </button>
    ) : (
      <Button variant="outline" className={`text-destructive hover:text-destructive ${className ?? ""}`} onClick={(e) => { e.stopPropagation(); setTyped(""); setOpen(true); }}>
        <Trash2 className="h-4 w-4 mr-1" />স্থায়ীভাবে মুছুন
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="text-destructive">স্থায়ীভাবে মুছে ফেলবেন?</DialogTitle>
            <DialogDescription>{what}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
              এটি আর ফেরানো যাবে না। {warning ?? ""} সংশ্লিষ্ট সদস্যের হিসাব নতুন করে মিলানো হবে। কে কী মুছেছে তা অডিট লগে থাকবে।
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="super-delete-confirm">নিশ্চিত করতে লিখুন: <b>DELETE</b></Label>
              <Input id="super-delete-confirm" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="DELETE" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>বাতিল</Button>
            <Button variant="destructive" disabled={busy || typed !== "DELETE"} onClick={run}>{busy ? "মুছে ফেলা হচ্ছে..." : "স্থায়ীভাবে মুছুন"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
