import { ExternalLink, Facebook, Instagram, Music2, Youtube } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ExternalPlatform = "facebook" | "youtube" | "instagram" | "tiktok";

const hostnameMatches = (hostname: string, allowed: string[]) => {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return allowed.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
};

export function detectExternalPlatform(url: string): ExternalPlatform | null {
  try {
    const host = new URL(url).hostname;
    if (hostnameMatches(host, ["facebook.com", "fb.watch"])) return "facebook";
    if (hostnameMatches(host, ["youtube.com", "youtu.be"])) return "youtube";
    if (hostnameMatches(host, ["instagram.com"])) return "instagram";
    if (hostnameMatches(host, ["tiktok.com"])) return "tiktok";
  } catch {
    return null;
  }
  return null;
}

export function externalPlatformLabel(platform: ExternalPlatform) {
  if (platform === "facebook") return "Facebook Live";
  if (platform === "youtube") return "YouTube Live";
  if (platform === "instagram") return "Instagram Live";
  return "TikTok LIVE";
}

function youtubeEmbed(url: string) {
  try {
    const parsed = new URL(url);
    let id = parsed.searchParams.get("v");
    if (!id && hostnameMatches(parsed.hostname, ["youtu.be"])) id = parsed.pathname.slice(1).split("/")[0];
    if (!id) id = parsed.pathname.match(/\/(?:live|embed)\/([^/]+)/)?.[1] ?? null;
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?playsinline=1` : null;
  } catch {
    return null;
  }
}

function facebookEmbed(url: string) {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=960`;
}

function facebookComments(url: string) {
  return `https://www.facebook.com/plugins/comments.php?href=${encodeURIComponent(url)}&width=100%&numposts=8&order=reverse_time`;
}

export function ExternalLiveEmbed({ url, platform: explicitPlatform }: { url: string; platform?: ExternalPlatform | null }) {
  const platform = explicitPlatform || detectExternalPlatform(url);
  const safeUrl = (() => {
    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
    } catch {
      return "";
    }
  })();
  const embedUrl = safeUrl && platform === "youtube" ? youtubeEmbed(safeUrl) : safeUrl && platform === "facebook" ? facebookEmbed(safeUrl) : null;
  const Icon = platform === "facebook" ? Facebook : platform === "youtube" ? Youtube : platform === "instagram" ? Instagram : Music2;
  const label = platform ? externalPlatformLabel(platform) : "Live externe";

  return (
    <Card className="overflow-hidden rounded-3xl">
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4" />{label}</div>
          <Button asChild size="sm" variant="outline" className="gap-1" disabled={!safeUrl}>
            <a href={safeUrl || "#"} target="_blank" rel="noopener noreferrer">Ouvrir <ExternalLink className="h-3.5 w-3.5" /></a>
          </Button>
        </div>
        {embedUrl ? (
          <iframe src={embedUrl} title={label} className="aspect-video w-full border-0 bg-black" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white">
            <Icon className="h-8 w-8" />
            <p className="font-semibold">Regardez ce direct sur {label}.</p>
            <p className="max-w-md text-xs text-white/60">Cette plateforme ne permet pas toujours d’intégrer son lecteur Live dans un autre site. Utilisez le bouton « Ouvrir » ci-dessus.</p>
          </div>
        )}
        {platform === "facebook" && embedUrl && (
          <div className="border-t bg-white p-3">
            <p className="mb-2 text-xs font-semibold text-gray-700">Commentaires Facebook</p>
            <iframe src={facebookComments(safeUrl)} title="Commentaires Facebook" className="min-h-[280px] w-full border-0" loading="lazy" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
