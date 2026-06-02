import { useEffect, useState } from "react";
import { Camera, Video, X, Leaf, AlertTriangle, Loader2, Sparkles } from "lucide-react";
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
  const [isEco, setIsEco] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name ?? "");
      setDescription(product.description ?? "");
      setCategory(product.category ?? "");
      setPriceStr(product.price != null ? String(product.price) : "");
      setDeliveryAvailable(!!product.delivery_available);
      setDeliveryFee(product.delivery_fee != null ? String(product.delivery_fee) : "");
      setIsEco(!!product.is_eco);
      setImages(product.images ?? []);
      setVideos(product.videos ?? []);
    } else {
      setName(""); setDescription(""); setCategory(""); setPriceStr("");
      setDeliveryAvailable(false); setDeliveryFee(""); setIsEco(false);
      setImages([]); setVideos([]);
    }
    setKeywords("");
  }, [product, open]);

  const handlePriceChange = (v: string) => {
    // Only digits, dot, comma
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
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${ownerId}/${startupId}/img-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast({ title: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setImages((p) => [...p, data.publicUrl]);
    }
    setUploading(false);
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

  const submit = async () => {
    if (!name.trim()) return toast({ title: t("productForm.errName"), variant: "destructive" });
    if (!description.trim()) return toast({ title: t("productForm.errDesc"), variant: "destructive" });
    if (!category) return toast({ title: t("productForm.errCategory"), variant: "destructive" });
    if (!priceStr.trim()) return toast({ title: t("productForm.errPriceReq"), variant: "destructive" });
    if (!PRICE_REGEX.test(priceStr.trim())) {
      return toast({ title: t("productForm.errPriceInvalid"), description: t("productForm.errPriceInvalidDesc"), variant: "destructive" });
    }
    const price = parseFloat(priceStr.replace(",", "."));
    if (!(price > 0)) return toast({ title: t("productForm.errPriceZero"), variant: "destructive" });
    if (images.length === 0) return toast({ title: t("productForm.errPhotoReq"), variant: "destructive" });
    let fee: number | null = null;
    if (deliveryAvailable && deliveryFee.trim()) {
      if (!PRICE_REGEX.test(deliveryFee.trim())) {
        return toast({ title: t("productForm.errDeliveryFee"), variant: "destructive" });
      }
      fee = parseFloat(deliveryFee.replace(",", "."));
    }

    setSaving(true);
    const payload = {
      startup_id: startupId,
      name: name.trim(),
      description: description.trim(),
      category,
      price,
      images,
      videos,
      delivery_available: deliveryAvailable,
      delivery_fee: fee,
      is_eco: isEco,
    };
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: product ? t("productForm.okUpdated") : t("productForm.okPublished") });
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
                <Sparkles className="h-3.5 w-3.5" /> Aide IA — décris en quelques mots
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
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
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
          </div>

          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
            <AlertTriangle className="mr-1 inline h-4 w-4 text-destructive" />
            <strong>{t("productForm.priceWarning1")}</strong> {t("productForm.priceWarning2")} <strong>{t("productForm.priceWarning3")}</strong>.
          </div>

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
                <div key={url} className="relative">
                  <img src={url} alt="" className="h-20 w-full rounded-md border object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
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

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("productForm.cancel")}</Button>
          <Button onClick={submit} disabled={saving || uploading} className="gradient-warm text-primary-foreground">
            {saving ? t("productForm.saving") : product ? t("productForm.update") : t("productForm.publish")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}