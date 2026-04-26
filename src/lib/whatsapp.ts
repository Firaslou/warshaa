import { supabase } from "@/integrations/supabase/client";

export async function openWhatsApp(opts: {
  phone: string;
  productName: string;
  startupId: string;
  productId?: string;
  message: string;
}) {
  const cleaned = opts.phone.replace(/[^\d]/g, "");
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(opts.message)}`;

  // Log click (fire-and-forget)
  const { data: { user } } = await supabase.auth.getUser();
  supabase.from("purchase_clicks").insert({
    startup_id: opts.startupId,
    product_id: opts.productId ?? null,
    user_id: user?.id ?? null,
  }).then(() => {});

  window.open(url, "_blank", "noopener,noreferrer");
}