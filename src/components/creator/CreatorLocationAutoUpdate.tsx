import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Updates a creator's public location once when they enter the creator space.
 *
 * Important privacy rule: this uses getCurrentPosition() only. It never uses
 * watchPosition(), never runs in the background, and never stores a location
 * history. The public map therefore shows only the creator's latest voluntary
 * one-shot location update.
 */
export function CreatorLocationAutoUpdate() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user || pathname !== "/creator") return;
    if (!navigator.geolocation) return;

    let cancelled = false;

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (cancelled) return;

        const latitude = Number(coords.latitude);
        const longitude = Number(coords.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return;

        // Keep this update limited to the authenticated creator's own startup.
        // The cast keeps the frontend compatible until generated Supabase types
        // are regenerated after the location migration.
        const { data: startup } = await supabase
          .from("startups")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (cancelled || !startup?.id) return;

        await supabase
          .from("startups")
          .update({ latitude, longitude } as any)
          .eq("id", startup.id)
          .eq("owner_id", user.id);
      },
      () => {
        // Location is optional. Do not interrupt the creator dashboard if
        // permission is denied, unavailable, or the request times out.
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );

    return () => {
      cancelled = true;
    };
  }, [pathname, user?.id]);

  return null;
}
