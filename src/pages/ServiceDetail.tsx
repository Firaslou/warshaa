import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, Lock, MapPin, MessageCircle, Star } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { PrivateChatDialog } from "@/components/PrivateChatDialog";
import { RatingBadge } from "@/components/RatingBadge";
import { ServicePhoneButton } from "@/components/ServicePhoneButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatServicePrice, SERVICE_LOCATIONS } from "@/lib/service-categories";
import type { ServiceRow } from "@/pages/Services";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ServiceReview = { id: string; user_id: string; rating: number; comment: string | null; created_at: string };
type ServiceWithStartup = ServiceRow & { startups: { id: string; owner_id: string; name: string; slug: string; city: string | null; logo_url: string | null; whatsapp_number: string | null } };
const db = supabase as any;

export default function ServiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [service, setService] = useState<ServiceWithStartup | null>(null);
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const serviceResult = await db.from("services").select("*, startups(id,owner_id,name,slug,city,logo_url,whatsapp_number)").eq("id", id).maybeSingle();
    const reviewResult = await db.from("service_reviews").select("*").eq("service_id", id).order("created_at", { ascending: false });
    setService(serviceResult.data ?? null);
    const rows = (reviewResult.data ?? []) as ServiceReview[];
    setReviews(rows);
    if (rows.length) {
      const profiles = await supabase.from("profiles").select("id,full_name").in("id", [...new Set(rows.map((row) => row.user_id))]);
      setAuthors(Object.fromEntries((profiles.data ?? []).map((profile: any) => [profile.id, profile.full_name ?? "Client Warsha"])));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);
  const summary = useMemo(() => reviews.length ? { average: reviews.reduce((total, row) => total + row.rating, 0) / reviews.length, count: reviews.length } : undefined, [reviews]);
  const myReview = reviews.find((row) => row.user_id === user?.id);

  const contactWhatsApp = () => {
    if (!user) return toast.info("Connectez-vous pour contacter ce prestataire.");
    if (!service?.startups.whatsapp_number) return toast.info("Ce prestataire n’a pas encore renseigné WhatsApp.");
    const phone = service.startups.whatsapp_number.replace(/[^\d]/g, "");
    const message = `Bonjour, je vous contacte depuis Warsha au sujet du service « ${service.name} ».`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const saveReview = async () => {
    if (!user) return toast.info("Connectez-vous pour laisser un avis.");
    if (!service || rating < 1) return toast.error("Choisissez une note.");
    if (service.startups.owner_id === user.id) return toast.error("Vous ne pouvez pas noter votre propre service.");
    setSaving(true);
    const payload = { user_id: user.id, service_id: service.id, rating, comment: comment.trim() || null };
    const result = myReview
      ? await db.from("service_reviews").update(payload).eq("id", myReview.id)
      : await db.from("service_reviews").insert(payload);
    setSaving(false);
    if (result.error) return toast.error(result.error.message);
    toast.success("Merci pour votre avis !");
    setRating(0); setComment("");
    void load();
  };

  if (loading) return <PageLayout><div className="container py-24 text-center text-muted-foreground">Chargement…</div></PageLayout>;
  if (!service) return <PageLayout><div className="container py-24 text-center">Service introuvable.</div></PageLayout>;

  return <PageLayout>
    <section className="container py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl bg-muted">{service.images?.[0] ? <img src={service.images[0]} alt={service.name} className="aspect-[4/3] h-full w-full object-cover" /> : <div className="aspect-[4/3]" />}</div>
        <div className="space-y-5">
          <Link to={`/startup/${service.startups.slug}`} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">{service.startups.logo_url && <img src={service.startups.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />} {service.startups.name}</Link>
          <div><h1 className="font-serif text-4xl font-bold">{service.name}</h1><RatingBadge rating={summary} className="mt-2 text-sm" /></div>
          <div className="text-2xl font-bold text-primary">{formatServicePrice(service)}</div>
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">{service.category}</Badge><Badge variant="outline"><MapPin className="mr-1 h-3.5 w-3.5" />{SERVICE_LOCATIONS[service.location_type]}</Badge>{service.duration_minutes && <Badge variant="outline"><Clock className="mr-1 h-3.5 w-3.5" />{service.duration_minutes} minutes</Badge>}</div>
          {service.service_area && <p className="text-sm"><strong>Zone :</strong> {service.service_area}</p>}
          {service.availability_text && <p className="text-sm"><strong>Disponibilités :</strong> {service.availability_text}</p>}
          {service.description && <p className="whitespace-pre-line leading-relaxed text-foreground/80">{service.description}</p>}
          <div className="flex flex-wrap gap-2"><Button onClick={contactWhatsApp}><MessageCircle className="mr-2 h-4 w-4" />Contacter sur WhatsApp</Button><ServicePhoneButton phone={service.contact_phone ?? service.startups.whatsapp_number} /><Button variant="outline" onClick={() => user ? setChatOpen(true) : toast.info("Connectez-vous pour ouvrir le chat privé.")}><Lock className="mr-2 h-4 w-4" />Chat privé</Button></div>
        </div>
      </div>

      <section className="mx-auto mt-12 max-w-3xl">
        <h2 className="font-serif text-2xl font-bold">Avis sur ce service ({reviews.length})</h2>
        {user && service.startups.owner_id !== user.id && <div className="my-5 space-y-3 rounded-2xl border bg-card p-4"><p className="font-medium">{myReview ? "Modifier votre avis" : "Noter ce service"}</p><div className="flex gap-1">{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} étoiles`}><Star className={cn("h-7 w-7", value <= rating ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40")} /></button>)}</div><Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="Partagez votre expérience…" /><Button disabled={saving || rating < 1} onClick={() => void saveReview()}>Publier l’avis</Button></div>}
        <div className="mt-5 space-y-3">{reviews.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Ce service n’a pas encore reçu d’avis.</p> : reviews.map((review) => <div key={review.id} className="rounded-xl border bg-card p-4"><div className="flex items-center justify-between"><strong>{authors[review.user_id] ?? "Client Warsha"}</strong><span className="text-amber-600">{"★".repeat(review.rating)}</span></div>{review.comment && <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>}</div>)}</div>
      </section>
    </section>
    <PrivateChatDialog open={chatOpen} onOpenChange={setChatOpen} startupId={service.startup_id} startupName={service.startups.name} />
  </PageLayout>;
}
