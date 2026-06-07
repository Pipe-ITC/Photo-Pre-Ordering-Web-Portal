export type ImageField = {
  key: string;
  label: string;
  hint: string;
};

export type Product = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  priceEnv: string;
  fallbackPrice: number;
  accent: string;
  imageFields: ImageField[];
};

export const products: Product[] = [
  {
    id: "medium-print",
    name: "Medium Print",
    eyebrow: "6 × 8 inch",
    description: "A classic festival print, ready to frame.",
    priceEnv: "PRICE_MEDIUM_PRINT",
    fallbackPrice: 1000,
    accent: "cyan",
    imageFields: [
      { key: "image", label: "Photo image", hint: "The ID shown beneath your chosen photo" }
    ]
  },
  {
    id: "large-print",
    name: "Large Print",
    eyebrow: "8 × 12 inch",
    description: "A larger statement print for your standout moment.",
    priceEnv: "PRICE_LARGE_PRINT",
    fallbackPrice: 1500,
    accent: "blue",
    imageFields: [
      { key: "image", label: "Photo image", hint: "The ID shown beneath your chosen photo" }
    ]
  },
  {
    id: "medium-large-bundle",
    name: "Medium / Large Bundle",
    eyebrow: "Two-print bundle",
    description: "One large and one medium print, with your choice of images.",
    priceEnv: "PRICE_MEDIUM_LARGE_BUNDLE",
    fallbackPrice: 2000,
    accent: "navy",
    imageFields: [
      { key: "largeImage", label: "Large print image", hint: "Image for the 8 × 12 print" },
      { key: "mediumImage", label: "Medium print image", hint: "Image for the 6 × 8 print" }
    ]
  },
  {
    id: "filled-frame",
    name: "Filled Frame",
    eyebrow: "Three-photo frame",
    description: "A portrait, team photo and action shot in one display.",
    priceEnv: "PRICE_FILLED_FRAME",
    fallbackPrice: 4000,
    accent: "cyan",
    imageFields: [
      { key: "portrait", label: "Portrait image", hint: "Your chosen individual portrait" },
      { key: "team", label: "Team photo image", hint: "Your chosen team photograph" },
      { key: "action", label: "Action shot image", hint: "Your chosen match action photograph" }
    ]
  },
  {
    id: "medal-frame",
    name: "Medal Frame",
    eyebrow: "Two-photo medal frame",
    description: "One action shot, and a choice of one portrait OR one team photo presented with your medal.",
    priceEnv: "PRICE_MEDAL_FRAME",
    fallbackPrice: 4500,
    accent: "blue",
    imageFields: [
      { key: "portrait", label: "Portrait image OR team photo image", hint: "Your chosen individual portrait OR team photograph" },
      { key: "action", label: "Action shot image", hint: "Your chosen match action photograph" }
    ]
  }
];

export function getProduct(productId: string) {
  return products.find((product) => product.id === productId);
}

export function getProductPrice(product: Product) {
  const configured = Number(process.env[product.priceEnv]);
  return Number.isInteger(configured) && configured > 0 ? configured : product.fallbackPrice;
}

export function getPublicProducts() {
  return products.map((product) => ({
    ...product,
    pricePence: getProductPrice(product)
  }));
}

export function formatPrice(pricePence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(pricePence / 100);
}
