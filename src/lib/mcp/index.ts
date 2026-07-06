import { defineMcp } from "@lovable.dev/mcp-js";
import listCreatorsTool from "./tools/list-creators";
import getCreatorTool from "./tools/get-creator";
import searchProductsTool from "./tools/search-products";

export default defineMcp({
  name: "warsha-mcp",
  title: "Warsha MCP",
  version: "0.1.0",
  instructions:
    "Tools for Warsha, a marketplace of Tunisian creators. Use list_creators to browse approved creators, get_creator for full details of one creator and their products, and search_products for keyword search across products.",
  tools: [listCreatorsTool, getCreatorTool, searchProductsTool],
});