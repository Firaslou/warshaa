import { ExternalLink, Facebook, Instagram, Music2, Youtube } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ExternalPlatform = "facebook" | "youtube" | "instagram" | "tiktok";

function detectPlatform(url: string): ExternalPlatform | null { try { const host = new URL(url).hostname.toLowerCase(); if (host.includes("facebook.com") || host.includes("fb.watch")) return "facebook"; if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube"; if (host.includes("instagram.com")) return "instagram"; if (host.includes("tiktok.com")) return "tiktok"; } catch { /* invalid URL */ } return null; }
function youtubeEmbed(url: string) { try { const parsed = new URL(url); let id = parsed.searchParams.get("v"); if (!id && parsed.hostname.includes("youtu.be")) id = parsed.pathname.slice(1).split("/")[0]; if (!id) id = parsed.pathname.match(/\/live\/([^/]+)/)?.[1] ?? null; return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=0&playsinline=1` : null; } catch { return null; } }
function facebookEmbed(url: string) { return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=960`; }
function facebookComments(url: string) { return `https://www.facebook.com/plugins/comments.php?href=${encodeURIComponent(url)}&width=100%&numposts=8&order=reverse_time`; }
function instagramEmbed(url: string) { try { const parsed = new URL(url); const match = parsed.pathname.match(/\/(p|reel|tv)\/([^/]+)/); return match ? `https://www.instagram.com/${match[1]}/${match[2]}/embed/` : null; } catch { return null; } }
function tiktokLiveEmbed(url: string) { try { const parsed = new URL(url); const match = parsed.pathname.match(/\/@([^/]+)/); return match ? `https://www.tiktok.com/embed/live/@${match[1]}?autoplay=0&muted=0&controls=1&embed_domain=${encodeURIComponent(window.location.hostname)}` : null; } catch { return null; } }

export function ExternalLiveEmbed({ url, platform: explicitPlatform }: { url: string; platform?: ExternalPlatform | null }) {
  const platform = explicitPlatform || detectPlatform(url); let embedUrl: string | null = null;
  if (platform === "youtube") embedUrl = youtubeEmbed(url); if (platform === "facebook") embedUrl = facebookEmbed(url); if (platform === "instagram") embedUrl = instagramEmbed(url); if (platform === "tiktok") embedUrl = tiktokLiveEmbed(url);
  const Icon = platform === "facebook" ? Facebook : platform === "youtube" ? Youtube : platform === "instagram" ? Instagram : Music2;
  const label = platform === "facebook" ? "Facebook Live" : platform === "youtube" ? "YouTube Live" : platform === "instagram" ? "Instagram" : "TikTok LIVE";
  return <Card className="overflow-hidden rounded-3xl"><CardContent className="p-0">
    <div className="flex items-center justify-between border-b bg-card px-4 py-3"><div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4" />{label}</div><Button asChild size="sm" variant="outline" className="gap-1"><a href={url} target="_blank" rel="noreferrer">Ouvrir <ExternalLink className="h-3.5 w-3.5" /></a></Button></div>
    {embedUrl ? <iframe src={embedUrl} title={label} className="aspect-video w-full border-0 bg-black" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" /> : <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black p-6 text-center text-white"><Icon className="h-8 w-8" /><p className="font-semibold">Le lecteur intégré n'est pas disponible pour cette URL.</p><p className="max-w-md text-xs text-white/60">Le bouton ci-dessus ouvre directement le Live sur {label}.</p></div>}
    {platform === "facebook" && <div className="border-t bg-white p-3"><p className="mb-2 text-xs font-semibold text-gray-700">Commentaires Facebook</p><iframe src={facebookComments(url)} title="Commentaires Facebook" className="min-h-[280px] w-full border-0" loading="lazy" /></div>}
  </CardContent></Card>;
}
