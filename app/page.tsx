import { getPublicProducts } from "@/lib/products";
import { Storefront } from "./storefront";

export const dynamic = "force-dynamic";

export default function Home() {
  return <Storefront products={getPublicProducts()} />;
}
