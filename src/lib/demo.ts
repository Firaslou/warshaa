import { StartupCardData } from "@/components/StartupCard";

/**
 * Demo data shown on the home & creators pages until real startups are approved.
 * Once admin approves real startups in the database, they'll automatically replace these.
 */
export const DEMO_STARTUPS: StartupCardData[] = [
  {
    id: "demo-1",
    slug: "atelier-zineb",
    name: "Atelier Zineb",
    tagline: "Bijoux faits main inspirés de la mer méditerranéenne.",
    city: "Sousse",
    category: "Bijoux",
    cover_url: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=800&q=80",
    badge: "verified",
    likes_count: 142,
    supporters_count: 38,
  },
  {
    id: "demo-2",
    slug: "lumina-bougies",
    name: "Lumina",
    tagline: "Bougies parfumées au jasmin et fleur d'oranger.",
    city: "Tunis",
    category: "Bougies",
    cover_url: "https://images.unsplash.com/photo-1602874801006-e26c4c9be556?w=800&q=80",
    badge: "certified",
    likes_count: 287,
    supporters_count: 91,
  },
  {
    id: "demo-3",
    slug: "cadres-medina",
    name: "Cadres Medina",
    tagline: "Encadrements artisanaux pour vos plus beaux souvenirs.",
    city: "Sfax",
    category: "Art & cadres",
    cover_url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&q=80",
    badge: "new",
    likes_count: 12,
    supporters_count: 3,
  },
  {
    id: "demo-4",
    slug: "sahel-leather",
    name: "Sahel Leather",
    tagline: "Maroquinerie en cuir véritable, cousue main à Monastir.",
    city: "Monastir",
    category: "Cuir",
    cover_url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80",
    badge: "verified",
    likes_count: 198,
    supporters_count: 54,
  },
  {
    id: "demo-5",
    slug: "ceramica-nour",
    name: "Cerámica Nour",
    tagline: "Vaisselle et déco en céramique peinte à la main.",
    city: "Nabeul",
    category: "Céramique",
    cover_url: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&q=80",
    badge: "certified",
    likes_count: 312,
    supporters_count: 124,
  },
  {
    id: "demo-6",
    slug: "dar-cosmetics",
    name: "Dar Cosmetics",
    tagline: "Cosmétiques naturels à base d'huile d'argan tunisienne.",
    city: "Tunis",
    category: "Cosmétiques",
    cover_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80",
    badge: "new",
    likes_count: 45,
    supporters_count: 18,
  },
  {
    id: "demo-7",
    slug: "olives-zaytoun",
    name: "Zaytoun",
    tagline: "Huile d'olive premium et tapenades artisanales.",
    city: "Sfax",
    category: "Gourmandises",
    cover_url: "https://images.unsplash.com/photo-1474898856510-884a2c0be0fe?w=800&q=80",
    badge: "verified",
    likes_count: 167,
    supporters_count: 72,
  },
  {
    id: "demo-8",
    slug: "amal-fashion",
    name: "Amal",
    tagline: "Mode contemporaine inspirée du patrimoine berbère.",
    city: "Tunis",
    category: "Mode",
    cover_url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
    badge: "new",
    likes_count: 89,
    supporters_count: 21,
  },
  {
    id: "demo-9",
    slug: "kids-medina",
    name: "Kids Medina",
    tagline: "Vêtements pour enfants brodés à la main, doux et colorés.",
    city: "Kairouan",
    category: "Enfants",
    cover_url: "https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=800&q=80",
    badge: "verified",
    likes_count: 134,
    supporters_count: 47,
  },
  {
    id: "demo-10",
    slug: "carthage-gifts",
    name: "Carthage Gifts",
    tagline: "Coffrets cadeaux personnalisés inspirés du patrimoine tunisien.",
    city: "Tunis",
    category: "Cadeaux",
    cover_url: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&q=80",
    badge: "certified",
    likes_count: 221,
    supporters_count: 86,
  },
];

export const TUNISIAN_CITIES = [
  "Tunis", "Sousse", "Sfax", "Monastir", "Nabeul", "Bizerte",
  "Gabès", "Kairouan", "Mahdia", "Hammamet", "Djerba", "Tozeur",
];

export const CATEGORIES = [
  "Bijoux", "Bougies", "Art & cadres", "Mode", "Cuir",
  "Céramique", "Cosmétiques", "Gourmandises", "Maison", "Autre",
];

export interface DemoProduct {
  id: string;
  startup_slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  video_url?: string | null;
  category: string;
  delegation: string;
  city: string;
  delivery_available: boolean;
  delivery_fee: number | null;
}

/**
 * Demo products linked to demo startups. Each product has up to 5 photos and
 * can include a short presentation video.
 */
export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: "demo-prod-1",
    startup_slug: "atelier-zineb",
    name: "Collier Méditerranée",
    description: "Collier artisanal inspiré des vagues de la Méditerranée. Pièce unique faite à la main avec des perles naturelles.",
    price: 89,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=1200&q=80",
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80",
      "https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=1200&q=80",
      "https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=1200&q=80",
      "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&q=80",
    ],
    video_url: null,
    category: "Bijoux",
    delegation: "Sousse Médina",
    city: "Sousse",
    delivery_available: true,
    delivery_fee: 7,
  },
  {
    id: "demo-prod-2",
    startup_slug: "atelier-zineb",
    name: "Bracelet Coffret cadeau",
    description: "Trio de bracelets coordonnés livrés dans un coffret cadeau élégant.",
    price: 145,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=1200&q=80",
      "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=1200&q=80",
      "https://images.unsplash.com/photo-1602752250015-52934bc45613?w=1200&q=80",
    ],
    video_url: null,
    category: "Bijoux",
    delegation: "Sousse Médina",
    city: "Sousse",
    delivery_available: true,
    delivery_fee: 0,
  },
  {
    id: "demo-prod-3",
    startup_slug: "atelier-zineb",
    name: "Boucles d'oreilles découverte",
    description: "Idéal pour découvrir le savoir-faire de la marque.",
    price: 45,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1200&q=80",
      "https://images.unsplash.com/photo-1633934542430-0905ddb5f0e7?w=1200&q=80",
    ],
    video_url: null,
    category: "Bijoux",
    delegation: "Sousse Médina",
    city: "Sousse",
    delivery_available: false,
    delivery_fee: null,
  },
  {
    id: "demo-prod-4",
    startup_slug: "lumina-bougies",
    name: "Bougie Jasmin de Tunis",
    description: "Bougie parfumée au jasmin frais, cire végétale 100% naturelle, 40h de combustion.",
    price: 38,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1602874801006-e26c4c9be556?w=1200&q=80",
      "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1200&q=80",
      "https://images.unsplash.com/photo-1608181831718-c9ffd8728f3d?w=1200&q=80",
      "https://images.unsplash.com/photo-1574263867128-2113f5e8b4f8?w=1200&q=80",
    ],
    video_url: null,
    category: "Bougies",
    delegation: "La Marsa",
    city: "Tunis",
    delivery_available: true,
    delivery_fee: 5,
  },
  {
    id: "demo-prod-5",
    startup_slug: "lumina-bougies",
    name: "Coffret Fleur d'oranger",
    description: "Trois bougies parfumées dans un coffret cadeau premium.",
    price: 95,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1601295461908-7b1bd25abf83?w=1200&q=80",
      "https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=1200&q=80",
    ],
    video_url: null,
    category: "Bougies",
    delegation: "La Marsa",
    city: "Tunis",
    delivery_available: true,
    delivery_fee: 0,
  },
  {
    id: "demo-prod-6",
    startup_slug: "cadres-medina",
    name: "Cadre photo bois sculpté",
    description: "Cadre artisanal en bois d'olivier sculpté à la main.",
    price: 65,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80",
      "https://images.unsplash.com/photo-1582640215093-1bbe7b76b1d6?w=1200&q=80",
    ],
    video_url: null,
    category: "Art & cadres",
    delegation: "Sfax Médina",
    city: "Sfax",
    delivery_available: true,
    delivery_fee: 8,
  },
  {
    id: "demo-prod-7",
    startup_slug: "sahel-leather",
    name: "Sac à main cuir cousu main",
    description: "Sac en cuir véritable de Monastir, finition artisanale.",
    price: 280,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&q=80",
      "https://images.unsplash.com/photo-1591561954557-26941169b49e?w=1200&q=80",
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=1200&q=80",
    ],
    video_url: null,
    category: "Cuir",
    delegation: "Monastir Centre",
    city: "Monastir",
    delivery_available: true,
    delivery_fee: 10,
  },
  {
    id: "demo-prod-8",
    startup_slug: "ceramica-nour",
    name: "Service à thé peint main",
    description: "Service à thé en céramique de Nabeul, motifs traditionnels peints à la main.",
    price: 175,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&q=80",
      "https://images.unsplash.com/photo-1578749556583-d3c1c7068c40?w=1200&q=80",
      "https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=1200&q=80",
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1200&q=80",
    ],
    video_url: null,
    category: "Céramique",
    delegation: "Nabeul Centre",
    city: "Nabeul",
    delivery_available: true,
    delivery_fee: 12,
  },
  {
    id: "demo-prod-9",
    startup_slug: "dar-cosmetics",
    name: "Huile d'argan pure 100ml",
    description: "Huile d'argan tunisienne pressée à froid, soin naturel pour cheveux et peau.",
    price: 55,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1200&q=80",
      "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=1200&q=80",
    ],
    video_url: null,
    category: "Cosmétiques",
    delegation: "Tunis Centre",
    city: "Tunis",
    delivery_available: true,
    delivery_fee: 5,
  },
  {
    id: "demo-prod-10",
    startup_slug: "olives-zaytoun",
    name: "Huile d'olive premium 500ml",
    description: "Huile d'olive extra vierge, première pression à froid, récolte 2025.",
    price: 42,
    currency: "TND",
    images: [
      "https://images.unsplash.com/photo-1474898856510-884a2c0be0fe?w=1200&q=80",
      "https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=1200&q=80",
    ],
    video_url: null,
    category: "Gourmandises",
    delegation: "Sfax Centre",
    city: "Sfax",
    delivery_available: true,
    delivery_fee: 6,
  },
];

export function getDemoProductsForStartup(slug: string): DemoProduct[] {
  return DEMO_PRODUCTS.filter((p) => p.startup_slug === slug);
}

export function getDemoProductById(id: string): DemoProduct | undefined {
  return DEMO_PRODUCTS.find((p) => p.id === id);
}