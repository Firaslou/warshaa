import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock, MapPin, Search, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RatingBadge } from "@/components/RatingBadge";
import { supabase } from "@/integrations/supabase/client";
import { aggregateRatings, type RatingSummary } from "@/lib/ratings";
import { formatServicePrice, SERVICE_CATEGORIES, SERVICE_LOCATIONS, type ServiceLocationType, type ServicePricingType } from "@/lib/service-categories";

export type ServiceRow = {
  id: string;
  startup_id: string;
  name: string;
  description: string | null;
  category: string;
  pricing_type: ServicePricingType;
  price: number | null;
  currency: string;
  images: string[];
  location_type: ServiceLocationType;
  service_area: string | null;
  duration_minutes: number | null;
  availability_text: string | null;
  startups: { name: string; slug: string; city: string | null; logo_url: string | null } | null;
};

const db = supabase as any;

export default function Services() {
  const [params, setParams] = useSearchParams();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [loading, setLoading] = useState(true);
  const search = params.get("q") ?? "";
  const category = params.get("category") ?? "all";

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const result = await db.from("services")
        .select("*, startups(name,slug,city,logo_url)")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(150);
      if (!active) return;
      const rows = (result.data ?? []) as ServiceRow[];
      setServices(rows);
      if (rows.length) {
        const reviewResult = await db.from("service_reviews").select("service_id,rating").in("service_id", rows.map((row) => row.id));
        if (active) setRatings(aggregateRatings(reviewResult.data ?? [], "service_id"));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => services.filter((service) => {
    const haystack = `${service.name} ${service.description ?? ""} ${service.category} ${service.service_area ?? ""} ${service.startups?.name ?? ""}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (category === "all" || service.category === category);
  }), [services, search, category]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <PageLayout>
      <section className="container py-8 sm:py-12">
        <div className="max-w-3xl">
          <Badge variant="secondary" className="mb-3 gap-1"><Sparkles className="h-3.5 w-3.5" /> Prestations locales</Badge>
          <h1 className="font-serif text-4xl font-bold">Services</h1>
          <p className="mt-2 text-muted-foreground">Jardinage, coiffure, transport, réparation et autres savoir-faire proposés par les créateurs Warsha.</p>
        </div>
        <div className="mt-6 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_260px]">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setParam("q", e.target.value)} placeholder="Rechercher un service ou une ville…" /></div>
          <Select value={category} onValueChange={(value) => setParam("category", value)}><SelectTrigger><SelectValue placeholder="Toutes les catégories" /></SelectTrigger><SelectContent><SelectItem value="all">Toutes les catégories</SelectItem>{SERVICE_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
        </div>

        {loading ? <div className="py-20 text-center text-muted-foreground">Chargement des services…</div> : filtered.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed p-12 text-center text-muted-foreground">Aucun service ne correspond à votre recherche.</div> : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((service) => <Card key={service.id} className="group overflow-hidden rounded-3xl">
              <Link to={`/service/${service.id}`} className="block aspect-[4/3] overflow-hidden bg-muted">{service.images?.[0] ? <img src={service.images[0]} alt={service.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center text-muted-foreground">Service</div>}</Link>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3"><Link to={`/service/${service.id}`} className="font-serif text-lg font-semibold hover:text-primary">{service.name}</Link><span className="shrink-0 text-sm font-bold text-primary">{formatServicePrice(service)}</span></div>
                <RatingBadge rating={ratings[service.id]} />
                {service.description && <p className="line-clamp-2 text-sm text-muted-foreground">{service.description}</p>}
                <div className="flex flex-wrap gap-1.5"><Badge variant="secondary">{service.category}</Badge><Badge variant="outline"><MapPin className="mr-1 h-3 w-3" />{SERVICE_LOCATIONS[service.location_type]}</Badge>{service.duration_minutes && <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{service.duration_minutes} min</Badge>}</div>
                {service.startups && <Link to={`/startup/${service.startups.slug}`} className="block border-t pt-3 text-xs text-primary hover:underline">Par {service.startups.name}{service.startups.city ? ` · ${service.startups.city}` : ""}</Link>}
              </CardContent>
            </Card>)}
          </div>
        )}
      </section>
    </PageLayout>
  );
}
