import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { SecureFileDropzone } from "@/components/SecureFileDropzone";
import { IMAGE_ACCEPT, imageExtensionFor, safeImageForUpload } from "@/lib/file-security";
import {
  SERVICE_CATEGORIES,
  SERVICE_LOCATIONS,
  SERVICE_PRICING,
  type ServiceLocationType,
  type ServicePricingType,
} from "@/lib/service-categories";
import { toast } from "sonner";
import { isValidContactPhone } from "@/lib/phone";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startupId: string;
  ownerId: string;
  startupPhone?: string | null;
  service?: any | null;
  onSaved: () => void;
};

const db = supabase as any;

export function ServiceFormDialog({ open, onOpenChange, startupId, ownerId, startupPhone, service, onSaved }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [pricingType, setPricingType] = useState<ServicePricingType>("quote");
  const [price, setPrice] = useState("");
  const [locationType, setLocationType] = useState<ServiceLocationType>("customer");
  const [serviceArea, setServiceArea] = useState("");
  const [duration, setDuration] = useState("");
  const [availability, setAvailability] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(service?.name ?? "");
    setDescription(service?.description ?? "");
    setCategory(service?.category ?? "");
    setCustomCategory(service?.custom_category ?? "");
    setContactPhone(service?.contact_phone ?? startupPhone ?? "");
    setPricingType(service?.pricing_type ?? "quote");
    setPrice(service?.price == null ? "" : String(service.price));
    setLocationType(service?.location_type ?? "customer");
    setServiceArea(service?.service_area ?? "");
    setDuration(service?.duration_minutes == null ? "" : String(service.duration_minutes));
    setAvailability(service?.availability_text ?? "");
    setImages(service?.images ?? []);
  }, [service, open, startupPhone]);

  const uploadImage = async (file: File) => {
    if (images.length >= 5) return;
    setUploading(true);
    try {
      const optimized = await safeImageForUpload(file, 10 * 1024 * 1024);
      const path = `${ownerId}/${startupId}/service-${crypto.randomUUID()}.${imageExtensionFor(optimized)}`;
      const { error } = await supabase.storage.from("product-images").upload(path, optimized, { contentType: optimized.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImages((current) => [...current, data.publicUrl]);
    } catch (error: any) {
      toast.error(error.message ?? "Échec de l’envoi de l’image.");
    } finally {
      setUploading(false);
    }
  };

  const save = async (publish: boolean) => {
    const parsedPrice = price.trim() ? Number(price.replace(",", ".")) : null;
    const parsedDuration = duration.trim() ? Number(duration) : null;
    if (!name.trim()) return toast.error("Le nom du service est obligatoire.");
    if (contactPhone.trim() && !isValidContactPhone(contactPhone)) {
      return toast.error("Utilisez un numéro de téléphone valide de 6 à 15 chiffres.");
    }
    if (publish && (!description.trim() || !category || images.length === 0)) {
      return toast.error("Pour publier, ajoutez une description, une catégorie et au moins une image.");
    }
    if (publish && category === "Autre" && customCategory.trim().length < 2) {
      return toast.error("Précisez le type de service pour la catégorie « Autre ».");
    }
    if (publish && !isValidContactPhone(contactPhone)) {
      return toast.error("Indiquez un numéro de téléphone valide.");
    }
    if (pricingType !== "quote" && (!Number.isFinite(parsedPrice) || Number(parsedPrice) < 0)) {
      return toast.error("Indiquez un prix valide ou choisissez « Sur devis ».");
    }
    if (parsedDuration != null && (!Number.isInteger(parsedDuration) || parsedDuration < 15)) {
      return toast.error("La durée minimale est de 15 minutes.");
    }

    setSaving(true);
    const payload = {
      startup_id: startupId,
      name: name.trim(),
      description: description.trim() || null,
      category,
      custom_category: category === "Autre" ? customCategory.trim() || null : null,
      contact_phone: contactPhone.trim() || null,
      pricing_type: pricingType,
      price: pricingType === "quote" ? null : parsedPrice,
      location_type: locationType,
      service_area: serviceArea.trim() || null,
      duration_minutes: parsedDuration,
      availability_text: availability.trim() || null,
      images,
      is_published: publish,
    };
    const result = service
      ? await db.from("services").update(payload).eq("id", service.id)
      : await db.from("services").insert(payload);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(publish ? "Service publié." : "Brouillon enregistré.");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-background">
        <DialogHeader><DialogTitle>{service ? "Modifier le service" : "Nouveau service"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Nom *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ex. Jardinage à domicile" /></div>
          <div className="sm:col-span-2"><Label>Description *</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} placeholder="Décrivez ce qui est inclus dans la prestation." /></div>
          <div><Label>Catégorie *</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{SERVICE_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          {category === "Autre" && <div><Label>Type de service *</Label><Input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} maxLength={80} placeholder="Ex. Accordeur de piano" /><p className="mt-1 text-xs text-muted-foreground">Ce texte aide la recherche ; les visiteurs verront la catégorie « Autre ».</p></div>}
          <div><Label>Numéro de téléphone *</Label><Input type="tel" inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={40} placeholder="+216 12 345 678" /><p className="mt-1 text-xs text-muted-foreground">Numéro prérempli depuis la boutique ; vous pouvez le modifier pour ce service.</p></div>
          <div><Label>Tarification</Label><Select value={pricingType} onValueChange={(value) => setPricingType(value as ServicePricingType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SERVICE_PRICING).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          {pricingType !== "quote" && <div><Label>Prix (TND)</Label><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.,]/g, ""))} /></div>}
          <div><Label>Lieu de prestation</Label><Select value={locationType} onValueChange={(value) => setLocationType(value as ServiceLocationType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(SERVICE_LOCATIONS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Zone desservie</Label><Input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} maxLength={160} placeholder="Ex. Tunis et Ariana" /></div>
          <div><Label>Durée indicative (minutes)</Label><Input type="number" min={15} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Disponibilités</Label><Input value={availability} onChange={(e) => setAvailability(e.target.value)} maxLength={300} placeholder="Ex. Lundi–samedi, 9h–18h, sur rendez-vous" /></div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Images *</Label>
            <div className="flex flex-wrap gap-2">{images.map((url) => <div key={url} className="relative h-24 w-24 overflow-hidden rounded-xl border"><img src={url} alt="Service" className="h-full w-full object-cover" /><button type="button" className="absolute right-1 top-1 rounded-full bg-background/90 p-1" onClick={() => setImages((current) => current.filter((item) => item !== url))}><X className="h-3 w-3" /></button></div>)}</div>
            <SecureFileDropzone compact accept={IMAGE_ACCEPT} disabled={uploading || images.length >= 5} multiple label={uploading ? "Validation en cours…" : "Déposez ou choisissez des images"} hint="JPG, PNG ou WEBP — max 10 Mo" onFiles={async (files) => { for (const file of files.slice(0, 5 - images.length)) await uploadImage(file); }} />
          </div>
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" disabled={saving || uploading} onClick={() => void save(false)}>Enregistrer le brouillon</Button><Button disabled={saving || uploading} onClick={() => void save(true)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publier</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
