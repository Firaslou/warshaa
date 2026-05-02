import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function ComplaintDialog({
  open, onOpenChange, startupId, startupName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  startupId: string;
  startupName: string;
}) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user) { toast.error("Connecte-toi pour envoyer une réclamation"); return; }
    if (subject.trim().length < 3) { toast.error("Sujet trop court"); return; }
    if (message.trim().length < 10) { toast.error("Message trop court (10 caractères min)"); return; }

    setLoading(true);
    const { error } = await supabase.from("complaints").insert({
      reporter_id: user.id,
      startup_id: startupId,
      subject: subject.trim().slice(0, 200),
      message: message.trim().slice(0, 2000),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }

    toast.success("Réclamation envoyée — nous la prenons au sérieux", {
      description: "Notre équipe va l'étudier et te répondra rapidement.",
      duration: 6000,
    });
    setSubject("");
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Réclamer · {startupName}
          </DialogTitle>
          <DialogDescription>
            Signale un problème avec ce créateur. Ta réclamation sera lue et traitée par l'administration de Warsha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Sujet *</Label>
            <Input
              maxLength={200}
              placeholder="Ex: Produit non conforme"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <Label>Détails *</Label>
            <Textarea
              rows={5}
              maxLength={2000}
              placeholder="Décris ce qui s'est passé…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">{message.length}/2000</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button onClick={submit} disabled={loading} className="gradient-warm text-primary-foreground">
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Flag className="mr-1 h-4 w-4" />}
            Envoyer la réclamation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}