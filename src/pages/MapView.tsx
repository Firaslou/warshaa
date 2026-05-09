import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Users, ArrowRight, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GOVERNORATE_COORDS, TUNISIA_CENTER, TUNISIA_BOUNDS } from "@/lib/tunisia-coords";
import { TUNISIA_GOVERNORATES } from "@/lib/tunisia";

interface CreatorPin {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  delegation: string | null;
  category: string | null;
  cover_url: string | null;
  logo_url: string | null;
}

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 10, { duration: 0.8 });
  }, [position, map]);
  return null;
}

export default function MapView() {
  const { t } = useTranslation();
  const [creators, setCreators] = useState<CreatorPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGov, setActiveGov] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("startups")
        .select("id, name, slug, city, delegation, category, cover_url, logo_url")
        .eq("status", "approved");
      setCreators((data ?? []) as CreatorPin[]);
      setLoading(false);
    })();
  }, []);

  // Group by governorate
  const grouped = useMemo(() => {
    const map = new Map<string, CreatorPin[]>();
    for (const gov of TUNISIA_GOVERNORATES) map.set(gov, []);
    for (const c of creators) {
      const gov = (c.city ?? "").trim();
      if (map.has(gov)) map.get(gov)!.push(c);
    }
    return map;
  }, [creators]);

  const totalLocated = useMemo(
    () => Array.from(grouped.values()).reduce((acc, list) => acc + list.length, 0),
    [grouped],
  );

  const flyPos = activeGov ? GOVERNORATE_COORDS[activeGov] ?? null : null;
  const activeList = activeGov ? grouped.get(activeGov) ?? [] : [];

  return (
    <PageLayout>
      <div className="container py-10">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <MapPin className="h-3 w-3" /> {t("map.badge")}
          </div>
          <h1 className="font-serif text-3xl font-bold md:text-4xl">{t("map.title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("map.subtitle", { count: totalLocated, govs: TUNISIA_GOVERNORATES.length })}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* MAP */}
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <MapContainer
              center={TUNISIA_CENTER}
              zoom={6}
              minZoom={5}
              maxBounds={TUNISIA_BOUNDS as L.LatLngBoundsExpression}
              maxBoundsViscosity={1}
              scrollWheelZoom
              style={{ height: "70vh", minHeight: 500, width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyTo position={flyPos} />

              {TUNISIA_GOVERNORATES.map((gov) => {
                const coord = GOVERNORATE_COORDS[gov];
                if (!coord) return null;
                const list = grouped.get(gov) ?? [];
                const count = list.length;
                const radius = Math.max(8, Math.min(28, 8 + count * 3));
                const isActive = activeGov === gov;
                return (
                  <CircleMarker
                    key={gov}
                    center={coord}
                    radius={radius}
                    pathOptions={{
                      color: count > 0 ? "hsl(16, 55%, 45%)" : "hsl(220, 9%, 55%)",
                      fillColor: count > 0 ? "hsl(22, 70%, 60%)" : "hsl(220, 14%, 90%)",
                      fillOpacity: count > 0 ? (isActive ? 0.85 : 0.55) : 0.25,
                      weight: isActive ? 3 : 1.5,
                    }}
                    eventHandlers={{ click: () => setActiveGov(gov) }}
                  >
                    <Tooltip direction="top" offset={[0, -radius]} opacity={1}>
                      <div className="text-xs font-semibold">{gov}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {count} {count > 1 ? t("map.creators") : t("map.creator")}
                      </div>
                    </Tooltip>
                    {count > 0 && (
                      <Popup>
                        <div className="min-w-[180px]">
                          <p className="font-serif text-base font-bold">{gov}</p>
                          <p className="mb-2 text-xs text-muted-foreground">
                            {count} {count > 1 ? t("map.creators") : t("map.creator")}
                          </p>
                          <button
                            onClick={() => setActiveGov(gov)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {t("map.viewList")} →
                          </button>
                        </div>
                      </Popup>
                    )}
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>

          {/* SIDEBAR */}
          <aside className="rounded-3xl border border-border bg-card p-5 shadow-card">
            {!activeGov ? (
              <div className="py-12 text-center">
                <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary/60" />
                <p className="text-sm text-muted-foreground">{t("map.selectHint")}</p>
                <div className="mt-6 grid gap-1 text-left">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("map.topRegions")}
                  </p>
                  {Array.from(grouped.entries())
                    .filter(([, list]) => list.length > 0)
                    .sort((a, b) => b[1].length - a[1].length)
                    .slice(0, 6)
                    .map(([gov, list]) => (
                      <button
                        key={gov}
                        onClick={() => setActiveGov(gov)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-accent"
                      >
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-primary" /> {gov}
                        </span>
                        <span className="text-xs text-muted-foreground">{list.length}</span>
                      </button>
                    ))}
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("map.region")}
                    </p>
                    <h2 className="font-serif text-xl font-bold">{activeGov}</h2>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {activeList.length}{" "}
                      {activeList.length > 1 ? t("map.creators") : t("map.creator")}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setActiveGov(null)}>
                    ✕
                  </Button>
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
                ) : activeList.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
                    {t("map.empty")}
                  </p>
                ) : (
                  <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                    {activeList.map((c) => (
                      <Link
                        key={c.id}
                        to={`/startup/${c.slug}`}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background p-2.5 transition hover:border-primary hover:shadow-card"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                          {c.logo_url ? (
                            <img src={c.logo_url} alt={c.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.delegation || c.city}
                            {c.category ? ` · ${c.category}` : ""}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </PageLayout>
  );
}