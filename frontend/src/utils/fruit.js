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