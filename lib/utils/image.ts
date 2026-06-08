import type { CSSProperties } from "react";
import type { ProductDetails } from "@/lib/types";

export const DEFAULT_IMAGE_POSITION = { x: 50, y: 50, scale: 1 };

/**
 * Inline style that frames a product image inside its square container exactly
 * as it was adjusted in the admin form (pan via object-position, zoom via
 * scale). Defaults to a plain centered cover, matching the old behaviour.
 */
export function imagePositionStyle(details: ProductDetails | null | undefined): CSSProperties {
  const p = details?.image_position ?? DEFAULT_IMAGE_POSITION;
  return {
    objectFit: "cover",
    objectPosition: `${p.x}% ${p.y}%`,
    transform: p.scale !== 1 ? `scale(${p.scale})` : undefined,
    transformOrigin: `${p.x}% ${p.y}%`,
  };
}
