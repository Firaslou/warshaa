import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCreatorsTool from "./tools/list-creators";
import getCreatorTool from "./tools/get-creator";
import searchProductsTool from "./tools/search-products";

// The MCP function is deployed to the Warsha-owned Supabase project.
const projectRef = "yqhanrhpigzvobwvmuoh";

export default defineMcp({
  name: "warsha-mcp",
  title: "Warsha MCP",
  version: "0.1.0",
  instructions:
    "Tools for Warsha, a marketplace of Tunisian creators. Use list_creators to browse approved creators, get_creator for full details of one creator and their products, and search_products for keyword search across products.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCreatorsTool, getCreatorTool, searchProductsTool],
});
