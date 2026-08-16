import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new Error("Supabase environment is not configured");
  return createClient(process.env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "search_products",
  title: "Search products",
  description: "Search products across approved Warsha creators by keyword in name or description.",
  inputSchema: {
    query: z.string().trim().min(1).max(200).describe("Free-text search query."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const client = sb();
    const escaped = query.replace(/[%_,]/g, (char) => `\\${char}`);
    const q = `%${escaped}%`;
    const { data, error } = await client
      .from("products")
      .select("id,name,description,price,currency,images,startup_id,startups!inner(name,slug,status)")
      .eq("is_published", true)
      .eq("startups.status", "approved")
      .or(`name.ilike.${q},description.ilike.${q}`)
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: "Search failed" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
