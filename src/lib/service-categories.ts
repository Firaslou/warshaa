export const SERVICE_CATEGORIES = [
  "Jardinage",
  "Auto-école",
  "Charpentier",
  "Menuisier",
  "Mécanicien",
  "Coiffure femme",
  "Coiffure homme",
  "Barbier à domicile",
  "Transport",
  "Nettoyage",
  "Réparation et bricolage",
  "Cours particuliers",
  "Photographie",
  "Bien-être",
  "Événementiel",
  "Autre",
] as const;

export const SERVICE_PRICING = {
  fixed: "Prix fixe",
  from: "À partir de",
  hourly: "Par heure",
  quote: "Sur devis",
} as const;

export const SERVICE_LOCATIONS = {
  provider: "Chez le prestataire",
  customer: "Chez le client",
  mobile: "Service mobile",
  remote: "À distance",
} as const;

export type ServicePricingType = keyof typeof SERVICE_PRICING;
export type ServiceLocationType = keyof typeof SERVICE_LOCATIONS;

export function formatServicePrice(service: {
  pricing_type: ServicePricingType;
  price: number | null;
  currency: string;
}) {
  if (service.pricing_type === "quote" || service.price == null) return "Sur devis";
  const amount = `${Number(service.price).toFixed(3)} ${service.currency}`;
  if (service.pricing_type === "from") return `À partir de ${amount}`;
  if (service.pricing_type === "hourly") return `${amount} / heure`;
  return amount;
}
