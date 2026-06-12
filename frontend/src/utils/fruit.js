export const FRUIT_TYPES = [
  { key: "pressec_groc",     label: "Pressec Groc",     group: "pressec" },
  { key: "pressec_barrejat", label: "Pressec Barrejat", group: "pressec" },
  { key: "pressec_vermell",  label: "Pressec Vermell",  group: "pressec" },
  { key: "albercoc",         label: "Albercoc" },
  { key: "cirera",           label: "Cirera" },
  { key: "melo",             label: "Meló" },
  { key: "sindria",          label: "Síndria" },
];

export const PEACH_SIZES = [15, 16, 18, 20, 22, 24, 26];

export const PLACES = ["Sant Pau", "La Girada", "Cantallops", "El Pla", "Puigdalber"];
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function renderFruitLabel(item) {
  if (item.fruit.startsWith("pressec_")) {
    const variant = item.fruit.split("_")[1];
    return `Pressec ${variant.charAt(0).toUpperCase() + variant.slice(1)}`;
  }
  const map = {
    albercoc: "Albercoc",
    cirera: "Cirera",
    melo: "Meló",
    sindria: "Síndria",
  };
  return map[item.fruit] || item.fruit;
}

export function renderFruitDetails(item) {
  if (item.fruit.startsWith("pressec_")) {
    const label = item.qty === 1 ? "caixa" : "caixes";
    return `${item.qty} ${label} · calibre ${item.size}`;
  }
  if (item.fruit === "albercoc" || item.fruit === "cirera") {
    const containerSingular = item.weight === 1 ? "Tarrina" : "Caixa";
    const containerPlural   = item.weight === 1 ? "Tarrines" : "Caixes";
    const label = item.qty > 1 ? containerPlural : containerSingular;
    return `${item.qty} ${label} (${item.weight}kg/u)`;
  }
  if (item.fruit === "melo" || item.fruit === "sindria") {
    const label = item.qty === 1 ? "peça" : "peces";
    return `${item.qty} ${label}${item.weight ? ` · ${item.weight} kg total` : ""}`;
  }
  return `${item.qty}`;
}

// Place → valid weekdays (0=Sun … 6=Sat)
export const PLACE_WEEKDAYS = {
  "Sant Pau":   [0, 6],
  "La Girada":  [3],
  "Puigdalber": [3],
  "El Pla":     [3],
  "Cantallops": [0, 1, 2, 3, 4, 5, 6],
};

// Returns array of date strings (YYYY-MM-DD) for the next 30 calendar days
// filtered to the weekdays valid for the given place.
export function getScrollDates(place) {
  const validDays = PLACE_WEEKDAYS[place] ?? [0, 1, 2, 3, 4, 5, 6];
  const todayBase = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });
  const [y, m, d] = todayBase.split('-').map(Number);
  const result = [];
  for (let i = 0; i < 30; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    if (validDays.includes(dt.getUTCDay())) {
      result.push(
        `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
      );
    }
  }
  return result;
}

// Day-of-week → available places (0=Sun, 6=Sat)
const PLACES_FOR_DAY = {
  0: ["Sant Pau", "Cantallops"],
  1: ["Cantallops"],
  2: ["Cantallops"],
  3: ["Cantallops", "La Girada", "El Pla", "Puigdalber"],
  4: ["Cantallops"],
  5: ["Cantallops"],
  6: ["Sant Pau", "Cantallops"],
};

export function getPlacesForDate(dateStr) {
  if (!dateStr) return PLACES;
  const date = new Date(dateStr + "T00:00:00");
  return PLACES_FOR_DAY[date.getDay()] ?? ["Cantallops"];
}

// Returns target weekday number for a place (null = any day = Cantallops)
export function getWeekdayForPlace(place) {
  if (place === "Sant Pau") return 6;
  if (["La Girada", "El Pla", "Puigdalber"].includes(place)) return 3;
  return null;
}

export function renderFruitExportLine(item) {
  if (item.fruit.startsWith("pressec_")) {
    const type = item.fruit.split("_")[1];
    const label = item.qty > 1 ? "caixes" : "caixa";
    return `Pressec ${type} · ${item.qty} ${label} · calibre ${item.size}`;
  }
  if (item.fruit === "albercoc" || item.fruit === "cirera") {
    const singular = item.weight === 1 ? "Tarrina" : "Caixa";
    const plural   = item.weight === 1 ? "Tarrines" : "Caixes";
    return `${capitalize(item.fruit)}: ${item.qty} ${item.qty > 1 ? plural : singular} (${item.weight}kg)`;
  }
  if (item.fruit === "melo" || item.fruit === "sindria") {
    return `${capitalize(item.fruit)}: ${item.qty} peces`;
  }
  return `${capitalize(item.fruit)}: ${item.qty}`;
}