// Approximate centroid coordinates for Tunisia's 24 governorates
export const GOVERNORATE_COORDS: Record<string, [number, number]> = {
  "Tunis": [36.8065, 10.1815],
  "Ariana": [36.8625, 10.1956],
  "Ben Arous": [36.7435, 10.2298],
  "Manouba": [36.8101, 10.0956],
  "Nabeul": [36.4514, 10.7357],
  "Zaghouan": [36.4028, 10.1428],
  "Bizerte": [37.2746, 9.8748],
  "Béja": [36.7256, 9.1817],
  "Jendouba": [36.5012, 8.7806],
  "Kef": [36.1742, 8.7050],
  "Siliana": [36.0844, 9.3708],
  "Sousse": [35.8245, 10.6346],
  "Monastir": [35.7780, 10.8262],
  "Mahdia": [35.5047, 11.0622],
  "Sfax": [34.7406, 10.7603],
  "Kairouan": [35.6781, 10.0962],
  "Kasserine": [35.1675, 8.8362],
  "Sidi Bouzid": [35.0381, 9.4858],
  "Gabès": [33.8814, 10.0982],
  "Médenine": [33.3548, 10.5055],
  "Tataouine": [32.9297, 10.4518],
  "Gafsa": [34.4225, 8.7842],
  "Tozeur": [33.9197, 8.1335],
  "Kébili": [33.7050, 8.9690],
};

// Map center + bounds
export const TUNISIA_CENTER: [number, number] = [34.8, 9.5];
export const TUNISIA_BOUNDS: [[number, number], [number, number]] = [[30.2, 7.5], [37.6, 11.6]];