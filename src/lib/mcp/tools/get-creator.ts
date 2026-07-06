import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_creator",
  title: "Get creator details",
  description: "Fetch full details for one approved creator by slug, including their products.",
  inputSchema: {
    slug: z.string().min(1).describe("The creator's slug (URL identifier)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const client = sb();
    const { data: startup, error } = await client
      .from("startups")
      .select("id,name,slug,tagline,description,category,categories,city,delegation,logo_url")
      .eq("slug", slug)
      .eq("status", "approved")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!startup) return { content: [{ type: "text", text: "Creator not found" }], isError: true };
    const { data: products } = await client
      .from("products")
      .select("id,name,description,price,image_url")
      .eq("startup_id", startup.id)
      .limit(50);
    const payload = { ...startup, products: products ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});