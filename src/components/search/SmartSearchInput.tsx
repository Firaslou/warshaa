import React, { useState, useEffect, useRef } from "react";
import { Search, X, History, Sparkles, Loader2, SearchCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getSearchHistory,
  saveSearchQuery,
  removeSearchHistoryItem,
  clearSearchHistory,
  fuzzyMatch,
} from "@/lib/search-utils";
import { cn } from "@/lib/utils";

interface SmartSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  className?: string;
  suggestionsPool?: Array<{ label: string; category?: string }>;
  aiLoading?: boolean;
  onRunAiSearch?: () => void;
}

const DEFAULT_POPULAR_TAGS = [
  "Poterie",
  "Céramique",
  "Tapis",
  "Cuir",
  "Huile d'olive",
  "Bijoux",
  "Robe traditionnelle",
  "Bois d'olivier",
];

export function SmartSearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "Rechercher un produit, un créateur, une matière...",
  className,
  suggestionsPool = [],
  aiLoading = false,
  onRunAiSearch,
}: SmartSearchInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (query: string) => {
    onChange(query);
    const updated = saveSearchQuery(query);
    setHistory(updated);
    setIsOpen(false);
    onSearch?.(query);
  };

  const handleRemoveHistory = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    const updated = removeSearchHistoryItem(item);
    setHistory(updated);
  };

  const handleClearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearSearchHistory();
    setHistory([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) {
        const updated = saveSearchQuery(value);
        setHistory(updated);
        setIsOpen(false);
        if (onRunAiSearch) {
          onRunAiSearch();
        } else {
          onSearch?.(value);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Filter pool suggestions with fuzzy matching
  const matchingSuggestions = value.trim()
    ? Array.from(
        new Set(
          suggestionsPool
            .filter((item) => fuzzyMatch(value, item.label))
            .map((item) => item.label)
        )
      ).slice(0, 6)
    : [];

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-11 rounded-2xl pl-10 pr-20 text-sm shadow-xs transition focus-visible:ring-2 focus-visible:ring-primary/20"
        />

        <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                inputRef.current?.focus();
              }}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Effacer"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {onRunAiSearch && (
            <button
              type="button"
              onClick={() => {
                if (value.trim()) {
                  saveSearchQuery(value);
                  setIsOpen(false);
                  onRunAiSearch();
                }
              }}
              disabled={aiLoading || !value.trim()}
              title="Recherche intelligente assistée"
              className="rounded-xl p-1.5 text-primary transition hover:bg-primary/10 disabled:opacity-30"
            >
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-border/80 bg-popover/95 p-3 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {value.trim() ? (
            <div className="space-y-3">
              {matchingSuggestions.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Suggestions
                  </p>
                  <div className="space-y-0.5">
                    {matchingSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSelect(suggestion)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition hover:bg-muted"
                      >
                        <Search className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleSelect(value)}
                className="flex w-full items-center justify-between rounded-xl bg-primary/5 px-3 py-2 text-left text-sm font-medium text-primary transition hover:bg-primary/10"
              >
                <span className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  <span>Rechercher « {value} »</span>
                </span>
                <span className="text-xs text-muted-foreground">Entrée ↵</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {history.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 pb-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <History className="h-3 w-3" /> Recherches récentes
                    </span>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Effacer tout
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {history.map((item) => (
                      <span
                        key={item}
                        onClick={() => handleSelect(item)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-foreground transition hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                      >
                        <History className="h-3 w-3 text-muted-foreground" />
                        {item}
                        <button
                          type="button"
                          onClick={(e) => handleRemoveHistory(e, item)}
                          className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" /> Tendances & catégories
                </div>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {DEFAULT_POPULAR_TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="cursor-pointer rounded-full px-3 py-1 text-xs transition hover:bg-primary/15 hover:text-primary active:scale-95"
                      onClick={() => handleSelect(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
