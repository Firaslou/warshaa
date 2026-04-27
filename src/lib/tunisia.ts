// 24 gouvernorats tunisiens avec leurs principales délégations / municipalités.
// Liste pragmatique, non exhaustive — couvre les zones les plus peuplées.

export const TUNISIA_GOVERNORATES = [
  "Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan",
  "Bizerte", "Béja", "Jendouba", "Kef", "Siliana", "Sousse",
  "Monastir", "Mahdia", "Sfax", "Kairouan", "Kasserine", "Sidi Bouzid",
  "Gabès", "Médenine", "Tataouine", "Gafsa", "Tozeur", "Kébili",
] as const;

export type Governorate = (typeof TUNISIA_GOVERNORATES)[number];

export const TUNISIA_DELEGATIONS: Record<Governorate, string[]> = {
  "Tunis": ["Bab El Bhar", "Bab Souika", "Carthage", "El Kabaria", "El Menzah", "El Omrane", "El Ouardia", "Ettahrir", "La Marsa", "La Goulette", "Le Bardo", "Sidi Bou Saïd", "Sijoumi"],
  "Ariana": ["Ariana Ville", "La Soukra", "Raoued", "Kalâat el-Andalous", "Sidi Thabet", "Ettadhamen", "Mnihla"],
  "Ben Arous": ["Ben Arous", "El Mourouj", "Hammam Lif", "Hammam Chott", "Boumhel", "Ezzahra", "Radès", "Mégrine", "Mohamedia", "Fouchana"],
  "Manouba": ["Manouba", "Den Den", "Douar Hicher", "Oued Ellil", "Mornaguia", "Borj El Amri", "Jedaida", "Tebourba"],
  "Nabeul": ["Nabeul", "Hammamet", "Dar Chaâbane", "Béni Khiar", "Korba", "Menzel Temime", "Kelibia", "Haouaria", "Soliman", "Grombalia", "Bou Argoub", "Menzel Bouzelfa"],
  "Zaghouan": ["Zaghouan", "Bir Mcherga", "El Fahs", "Nadhour", "Saouaf", "Zriba"],
  "Bizerte": ["Bizerte Nord", "Bizerte Sud", "Menzel Bourguiba", "Ras Jebel", "Mateur", "Tinja", "Sejnane", "Joumine", "Ghar El Melh", "Utique"],
  "Béja": ["Béja Nord", "Béja Sud", "Amdoun", "Goubellat", "Medjez El Bab", "Nefza", "Téboursouk", "Testour", "Thibar"],
  "Jendouba": ["Jendouba Nord", "Jendouba Sud", "Aïn Draham", "Tabarka", "Bou Salem", "Fernana", "Ghardimaou", "Oued Mliz"],
  "Kef": ["Kef Est", "Kef Ouest", "Dahmani", "Sakiet Sidi Youssef", "Tajerouine", "Nebeur", "Jérissa", "Le Sers", "Kalâat Senan"],
  "Siliana": ["Siliana Nord", "Siliana Sud", "Bargou", "Bouarada", "El Aroussa", "Gaâfour", "Kesra", "Makthar", "Rohia"],
  "Sousse": ["Sousse Médina", "Sousse Riadh", "Sousse Jaouhara", "Sousse Sidi Abdelhamid", "Hammam Sousse", "Akouda", "Kalâa Kebira", "Kalâa Seghira", "Msaken", "Enfida", "Hergla"],
  "Monastir": ["Monastir", "Khniss", "Ouerdanine", "Sahline", "Bekalta", "Jemmal", "Ksar Hellal", "Ksibet El Mediouni", "Moknine", "Sayada", "Téboulba", "Zéramdine"],
  "Mahdia": ["Mahdia", "Bou Merdès", "Chebba", "Chorbane", "El Jem", "Hebira", "Ksour Essef", "Melloulèche", "Ouled Chamekh", "Sidi Alouane"],
  "Sfax": ["Sfax Médina", "Sfax Ouest", "Sfax Sud", "Sakiet Ezzit", "Sakiet Eddaier", "Route Mahdia", "Route Aïn", "Route Lafrane", "Gremda", "Thyna", "El Amra", "Agareb", "Bir Ali Ben Khalifa", "Jebiniana", "Kerkennah", "Mahres", "Menzel Chaker", "Skhira"],
  "Kairouan": ["Kairouan Nord", "Kairouan Sud", "Bouhajla", "Chebika", "Echrarda", "El Alâa", "Haffouz", "Hajeb El Ayoun", "Nasrallah", "Oueslatia", "Sbikha"],
  "Kasserine": ["Kasserine Nord", "Kasserine Sud", "Ezzouhour", "Hassi El Frid", "Fériana", "Foussana", "Hidra", "Jedelienne", "Mejel Bel Abbès", "Sbeitla", "Sbiba", "Thala"],
  "Sidi Bouzid": ["Sidi Bouzid Est", "Sidi Bouzid Ouest", "Bir El Hafey", "Cebbala", "Jilma", "Mejel Bel Abbès", "Menzel Bouzaiane", "Meknassy", "Mezzouna", "Ouled Haffouz", "Regueb", "Souk Jedid"],
  "Gabès": ["Gabès Médina", "Gabès Ouest", "Gabès Sud", "Chenini Nahal", "El Hamma", "Ghannouch", "Mareth", "Matmata", "Menzel El Habib", "Nouvelle Matmata"],
  "Médenine": ["Médenine Nord", "Médenine Sud", "Ben Gardane", "Beni Khedache", "Djerba Houmt Souk", "Djerba Midoun", "Djerba Ajim", "Sidi Makhloulf", "Zarzis"],
  "Tataouine": ["Tataouine Nord", "Tataouine Sud", "Bir Lahmar", "Dehiba", "Ghomrassen", "Remada", "Smar"],
  "Gafsa": ["Gafsa Nord", "Gafsa Sud", "Belkhir", "El Guettar", "El Ksar", "Mdhilla", "Métlaoui", "Moularès", "Redeyef", "Sidi Aïch", "Sned"],
  "Tozeur": ["Tozeur", "Degache", "Hammet Jerid", "Nefta", "Tameghza"],
  "Kébili": ["Kébili Nord", "Kébili Sud", "Douz Nord", "Douz Sud", "Faouar", "Souk Lahad"],
};

// 16 univers / catégories
export const CATEGORIES_KEYS = [
  "jewelry", "candles", "art", "fashion", "leather",
  "ceramics", "cosmetics", "food", "home", "thrift",
  "women", "men", "kids", "gifts", "personalized", "other",
] as const;

export type CategoryKey = (typeof CATEGORIES_KEYS)[number];
