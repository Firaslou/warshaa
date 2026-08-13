import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface FavoritesContextType {
  favoriteProductIds: Set<string>;
  favoriteStartupIds: Set<string>;
  isProductFavorite: (productId: string) => boolean;
  isStartupFavorite: (startupId: string) => boolean;
  toggleProductFavorite: (productId: string) => Promise<boolean>;
  toggleStartupFavorite: (startupId: string) => Promise<boolean>;
  favoriteProductsCount: number;
  favoriteStartupsCount: number;
  loading: boolean;
  refreshFavorites: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favoriteProductIds, setFavoriteProductIds] = useState<Set<string>>(new Set());
  const [favoriteStartupIds, setFavoriteStartupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteProductIds(new Set());
      setFavoriteStartupIds(new Set());
      setLoading(false);
      return;
    }

    try {
      const [{ data: favRows, error: favError }, { data: likeRows, error: likeError }] = await Promise.all([
        supabase
          .from("favorites")
          .select("product_id, startup_id")
          .eq("user_id", user.id),
        supabase
          .from("product_likes")
          .select("product_id")
          .eq("user_id", user.id),
      ]);

      if (favError && likeError) {
        console.error("Error loading favorites:", favError || likeError);
      }

      const prodIds = new Set<string>();
      const startIds = new Set<string>();

      (favRows ?? []).forEach((row) => {
        if (row.product_id) prodIds.add(row.product_id);
        if (row.startup_id) startIds.add(row.startup_id);
      });

      (likeRows ?? []).forEach((row) => {
        if (row.product_id) prodIds.add(row.product_id);
      });

      setFavoriteProductIds(prodIds);
      setFavoriteStartupIds(startIds);
    } catch (err) {
      console.error("Failed to fetch favorites:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadFavorites();

    if (!user) return;

    const channel = supabase
      .channel(`user-favorites:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "favorites", filter: `user_id=eq.${user.id}` },
        () => void loadFavorites()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_likes", filter: `user_id=eq.${user.id}` },
        () => void loadFavorites()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadFavorites]);

  const isProductFavorite = useCallback(
    (productId: string) => favoriteProductIds.has(productId),
    [favoriteProductIds]
  );

  const isStartupFavorite = useCallback(
    (startupId: string) => favoriteStartupIds.has(startupId),
    [favoriteStartupIds]
  );

  const toggleProductFavorite = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!user) {
        toast.info("Connectez-vous pour ajouter ce produit à vos favoris.");
        return false;
      }

      const currentlyFavorite = favoriteProductIds.has(productId);

      // Optimistic update
      setFavoriteProductIds((prev) => {
        const next = new Set(prev);
        if (currentlyFavorite) next.delete(productId);
        else next.add(productId);
        return next;
      });

      try {
        if (currentlyFavorite) {
          const [{ error: favErr }, { error: likeErr }] = await Promise.all([
            supabase.from("favorites").delete().eq("user_id", user.id).eq("product_id", productId),
            supabase.from("product_likes").delete().eq("user_id", user.id).eq("product_id", productId),
          ]);
          if (favErr && likeErr) throw favErr || likeErr;
          toast.success("Produit retiré des favoris");
          return false;
        } else {
          const [{ error: favErr }, { error: likeErr }] = await Promise.all([
            supabase.from("favorites").insert({ user_id: user.id, product_id: productId }),
            supabase.from("product_likes").insert({ user_id: user.id, product_id: productId }),
          ]);
          if (favErr && likeErr) throw favErr || likeErr;
          toast.success("Produit ajouté aux favoris ❤️");
          return true;
        }
      } catch (err: any) {
        // Rollback
        setFavoriteProductIds((prev) => {
          const next = new Set(prev);
          if (currentlyFavorite) next.add(productId);
          else next.delete(productId);
          return next;
        });
        toast.error("Impossible de modifier le favori.");
        return currentlyFavorite;
      }
    },
    [user, favoriteProductIds]
  );

  const toggleStartupFavorite = useCallback(
    async (startupId: string): Promise<boolean> => {
      if (!user) {
        toast.info("Connectez-vous pour suivre ce créateur.");
        return false;
      }

      const currentlyFavorite = favoriteStartupIds.has(startupId);

      // Optimistic update
      setFavoriteStartupIds((prev) => {
        const next = new Set(prev);
        if (currentlyFavorite) next.delete(startupId);
        else next.add(startupId);
        return next;
      });

      try {
        if (currentlyFavorite) {
          const { error } = await supabase
            .from("favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("startup_id", startupId);
          if (error) throw error;
          toast.success("Créateur retiré de vos favoris");
          return false;
        } else {
          const { error } = await supabase
            .from("favorites")
            .insert({ user_id: user.id, startup_id: startupId });
          if (error) throw error;
          toast.success("Créateur ajouté à vos favoris ❤️");
          return true;
        }
      } catch (err: any) {
        // Rollback
        setFavoriteStartupIds((prev) => {
          const next = new Set(prev);
          if (currentlyFavorite) next.add(startupId);
          else next.delete(startupId);
          return next;
        });
        toast.error("Impossible de modifier le favori.");
        return currentlyFavorite;
      }
    },
    [user, favoriteStartupIds]
  );

  return (
    <FavoritesContext.Provider
      value={{
        favoriteProductIds,
        favoriteStartupIds,
        isProductFavorite,
        isStartupFavorite,
        toggleProductFavorite,
        toggleStartupFavorite,
        favoriteProductsCount: favoriteProductIds.size,
        favoriteStartupsCount: favoriteStartupIds.size,
        loading,
        refreshFavorites: loadFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
