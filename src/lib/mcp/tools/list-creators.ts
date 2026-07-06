import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_creators",
  title: "List creators",
  description: "List approved Tunisian creators on Warsha. Optionally filter by category or city.",
  inputSchema: {
    category: z.string().optional().describe("Category filter, e.g. 'bijoux', 'cosmétiques'."),
    city: z.string().optional().describe("City filter, e.g. 'Tunis'."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category, city, limit }) => {
    let q = sb()
      .from("startups")
      .select("name,slug,tagline,category,city,delegation")
      .eq("status", "approved")
      .limit(limit ?? 20);
    if (category) q = q.ilike("category", `%${category}%`);
    if (city) q = q.ilike("city", `%${city}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { creators: data ?? [] },
    };
  },
});