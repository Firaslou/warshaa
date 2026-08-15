import { useEffect, useState } from "react";
import { Camera, Video, X, Leaf, AlertTriangle, Loader2, Bot, ArrowLeft, ArrowRight, Eye, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES_KEYS } from "@/lib/tunisia";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { blobToFile, compressImage } from "@/lib/image-utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  startupId: string;
  ownerId: string;
  product?: any | null;
  onSaved: () => void;
}

const PRICE_REGEX = /^[0-9]+([.,][0-9]{1,3})?$/;

export function ProductFormDialog({ open, onOpenChange, startupId, ownerId, product, onSaved }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [priceStr, setPriceStr] = useState("");
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [isEco, setIsEco] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name ?? "");
      setDescription(product.description ?? "");
      setCategory(product.category ?? "");
      setPriceStr(product.price != null ? String(product.price) : "");
      // Modification ici : On lit directement la vraie valeur depuis Supabase
      setDiscountPercentage(product.discount_percentage ?? 0);
      setDeliveryAvailable(!!product.delivery_available);
      setDeliveryFee(product.delivery_fee != null ? String(product.delivery_fee) : "");
      setIsEco(!!product.is_eco);
      setImages(product.images ?? []);
      setVideos(product.videos ?? []);
    } else {
      setName(""); setDescription(""); setCategory(""); setPriceStr("");
      setDeliveryAvailable(false); setDeliveryFee(""); setIsEco(false);
      setImages([]); setVideos([]); setDiscountPercentage(0);
    }
    setKeywords("");
  }, [product, open]);

  const handlePriceChange = (v: string) => {
    const cleaned = v.replace(/[^0-9.,]/g, "");
    setPriceStr(cleaned);
  };

  const generateDescription = async () => {
    if (!keywords.trim()) {
      toast({ title: "Ajoute quelques mots-clés", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-description", {
        body: { name, category, keywords },
      });
      if (error) throw error;
      if (data?.description) {
        setDescription(data.description);
        toast({ title: "Description générée ✨" });
      } else {
        toast({ title: data?.error || "Réessaie", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Génération échouée", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (images.length >= 5) {
      toast({ title: t("productForm.errMax5"), variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: t("productForm.errImage"), variant: "destructive" });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Image trop volumineuse", description: "La taille maximale est de 15 Mo.", variant: "destructive" });
      return;
    }
    setUploading(true);
    let optimizedFile = file;
    try {
      const compressedBlob = await compressImage(file, { maxWidth: 1800, quality: 0.82 });
      optimizedFile = compressedBlob.size < file.size ? blobToFile(compressedBlob, file.name) : file;
    } catch {
      // Fall back to the original image if this browser cannot compress it.
    }
    const ext = optimizedFile.name.split(".").pop();
    const path = `${ownerId}/${startupId}/img-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, optimizedFile, {
      contentType: optimizedFile.type,
    });
    if (error) {
      toast({ title: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImages((p) => [...p, data.publicUrl]);
    }
    setUploading(false);
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    setImages((current) => {
      const next = [...current];
      const [image] = next.splice(from, 1);
      next.splice(to, 0, image);
      return next;
    });
  };

  const uploadVideo = async (file: File) => {
    if (videos.length >= 2) {
      toast({ title: t("productForm.errMax2"), variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("video/")) {
      toast({ title: t("productForm.errVideoFile"), variant: "destructive" });
      return;
    }
    const duration = await new Promise<number>((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => resolve(v.duration);
      v.onerror = () => resolve(0);
      v.src = URL.createObjectURL(file);
    });
    if (duration > 61) {
      toast({
        title: t("productForm.errVideoLong"),
        description: t("productForm.errVideoLongDesc", { n: Math.round(duration) }),
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${ownerId}/${startupId}/vid-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast({ title: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setVideos((p) => [...p, data.publicUrl]);
    }
    setUploading(false);
  };

  const missingPublicationFields = [
    !name.trim() ? "nom" : null,
    !description.trim() ? "description" : null,
    !category ? "catégorie" : null,
    !priceStr.trim() || !PRICE_REGEX.test(priceStr.trim()) || !(parseFloat(priceStr.replace(",", ".")) > 0) ? "prix valide" : null,
    images.length === 0 ? "photo" : null,
  ].filter(Boolean) as string[];

  const submit = async (publish: boolean) => {
    if (!name.trim()) return toast({ title: t("productForm.errName"), variant: "destructive" });
    if (publish && missingPublicationFields.length > 0) {
      return toast({ title: "Produit incomplet", description: `Ajoutez : ${missingPublicationFields.join(", ")}.`, variant: "destructive" });
    }
    const price = priceStr.trim() && PRICE_REGEX.test(priceStr.trim())
      ? parseFloat(priceStr.replace(",", "."))
      : null;
    let fee: number | null = null;
    if (deliveryAvailable && deliveryFee.trim()) {
      if (!PRICE_REGEX.test(deliveryFee.trim())) {
        return toast({ title: t("productForm.errDeliveryFee"), variant: "destructive" });
      }
      fee = parseFloat(deliveryFee.replace(",", "."));
    }

    setSaving(true);
    
    // Modification ici : On ajoute directement discount_percentage au payload envoyé à Supabase
    const payload = {
      startup_id: startupId,
      name: name.trim(),
      description: description.trim() || null,
      category: category || null,
      price,
      images,
      videos,
      delivery_available: deliveryAvailable,
      delivery_fee: fee,
      is_eco: isEco,
      is_published: publish,
      discount_percentage: discountPercentage || 0, // <-- LE TUYAU EST BRANCHÉ ICI !
    };

    let { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);

    if (error && publish && /is_published/i.test(error.message)) {
      const { is_published: _isPublished, ...legacyPayload } = payload;
      const legacyResult = product
        ? await supabase.from("products").update(legacyPayload).eq("id", product.id)
        : await supabase.from("products").insert(legacyPayload);
      error = legacyResult.error;
    }

    setSaving(false);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: publish ? (product ? t("productForm.okUpdated") : t("productForm.okPublished")) : "Brouillon enregistré" });
    onSaved();
    onOpenChange(false);
    
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{product ? t("productForm.editTitle") : t("productForm.newTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t("productForm.name")} *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>{t("productForm.shortDescription")} *</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
            <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Bot className="h-3.5 w-3.5" /> Aide IA — décris en quelques mots
              </div>
              <div className="flex gap-2">
                <Input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="ex: bougie cire abeille senteur jasmin fait main"
                  maxLength={300}
                  className="h-9"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={generateDescription}
                  disabled={generating || !keywords.trim()}
                  className="shrink-0 gradient-warm text-primary-foreground"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                  {generating ? "..." : "Générer"}
                </Button>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("productForm.category")} *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {CATEGORIES_KEYS.map((c) => <SelectItem key={c} value={c}>{t(`categoriesExt.${c}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("productForm.price")} *</Label>
              <Input
                inputMode="decimal"
                placeholder={t("productForm.pricePlaceholder")}
                value={priceStr}
                onChange={(e) => handlePriceChange(e.target.value)}
              />
            </div>
            <div>
              <Label>Pourcentage de solde (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                placeholder="Ex: 20 (laisser 0 si pas de solde)"
              />
            </div>
          </div>

          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
            <AlertTriangle className="mr-1 inline h-4 w-4 text-destructive" />
            <strong>{t("productForm.priceWarning1")}</strong> {t("productForm.priceWarning2")} <strong>{t("productForm.priceWarning3")}</strong>.
          </div>

          {missingPublicationFields.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Avant de publier</div>
              <p className="mt-1">Il manque : {missingPublicationFields.join(", ")}. Vous pouvez quand même enregistrer ce produit comme brouillon.</p>
            </div>
          )}

          <div className="rounded-lg border p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={deliveryAvailable} onCheckedChange={(v) => setDeliveryAvailable(!!v)} />
              <span className="text-sm font-medium">{t("productForm.deliveryAvailable")}</span>
            </label>
            {deliveryAvailable && (
              <div className="mt-3">
                <Label>{t("productForm.deliveryFee")}</Label>
                <Input
                  inputMode="decimal"
                  placeholder={t("productForm.deliveryFeePlaceholder")}
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.,]/g, ""))}
                />
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3">
            <Checkbox checked={isEco} onCheckedChange={(v) => setIsEco(!!v)} />
            <Leaf className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">{t("productForm.ecoLabel")}</span>
          </label>

          {/* Photos */}
          <div>
            <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> {t("productForm.photos")} * ({images.length}/5)</Label>
            <p className="mt-1 text-xs text-muted-foreground">{t("productForm.photosHint")}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {images.map((url, i) => (
                <div key={url} className="group relative">
                  <img src={url} alt="" className="h-20 w-full rounded-md border object-cover" />
                  {i === 0 && <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium">Principale</span>}
                  <button
                    type="button"
                    onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  <div className="absolute bottom-1 right-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                    <button type="button" disabled={i === 0} onClick={() => moveImage(i, i - 1)} className="rounded bg-background/90 p-1 disabled:opacity-30" aria-label="Déplacer l’image à gauche"><ArrowLeft className="h-3 w-3" /></button>
                    <button type="button" disabled={i === images.length - 1} onClick={() => moveImage(i, i + 1)} className="rounded bg-background/90 p-1 disabled:opacity-30" aria-label="Déplacer l’image à droite"><ArrowRight className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
              {images.length < 5 && (
                <label className="flex h-20 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-xs text-muted-foreground hover:border-primary">
                  {t("productForm.addPhoto")}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Vidéos */}
          <div>
            <Label className="flex items-center gap-2"><Video className="h-4 w-4" /> {t("productForm.videos")} ({videos.length}/2)</Label>
            <p className="mt-1 text-xs text-muted-foreground">{t("productForm.videosHint")}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {videos.map((url, i) => (
                <div key={url} className="relative">
                  <video src={url} controls className="h-32 w-full rounded-md border" />
                  <button
                    type="button"
                    onClick={() => setVideos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {videos.length < 2 && (
                <label className="flex h-32 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-xs text-muted-foreground hover:border-primary">
                  {t("productForm.addVideo")}
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
                  />
                </label>
              )}
            </div>
          </div>

          {uploading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t("productForm.uploading")}
            </p>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("productForm.cancel")}</Button>
          <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={uploading}>
            <Eye className="mr-2 h-4 w-4" /> Aperçu
          </Button>
          {!product?.is_published && (
            <Button variant="outline" onClick={() => submit(false)} disabled={saving || uploading || !name.trim()}>
              <Save className="mr-2 h-4 w-4" /> {saving ? t("productForm.saving") : "Enregistrer le brouillon"}
            </Button>
          )}
          <Button onClick={() => submit(true)} disabled={saving || uploading} className="gradient-warm text-primary-foreground">
            {saving ? t("productForm.saving") : product?.is_published ? t("productForm.update") : t("productForm.publish")}
          </Button>
        </DialogFooter>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-md bg-background">
            <DialogHeader><DialogTitle className="font-serif">Aperçu du produit</DialogTitle></DialogHeader>
            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="aspect-square bg-muted">
                {images[0] ? <img src={images[0]} alt={name || "Aperçu"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground"><Camera className="h-10 w-10" /></div>}
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-serif text-2xl font-bold">{name || "Nom du produit"}</h3>
                  <span className="shrink-0 font-semibold text-primary">{priceStr || "—"} TND</span>
                </div>
                <p className="text-sm text-muted-foreground">{description || "La description du produit apparaîtra ici."}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {category && <span className="rounded-full bg-muted px-2 py-1">{t(`categoriesExt.${category}`)}</span>}
                  {deliveryAvailable && <span className="rounded-full bg-muted px-2 py-1">Livraison disponible</span>}
                  {isEco && <span className="rounded-full bg-green-100 px-2 py-1 text-green-700">Écoresponsable</span>}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
