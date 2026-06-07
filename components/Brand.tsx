import Image from "next/image";
import { cn } from "@/lib/utils/cn";

/** FlopShop logo mark (+ optional wordmark). The logo art is on a black tile. */
export function Brand({
  size = 36,
  showText = true,
  textClassName,
}: {
  size?: number;
  showText?: boolean;
  textClassName?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="grid shrink-0 place-items-center overflow-hidden rounded-xl bg-black ring-1 ring-black/10"
        style={{ width: size, height: size }}
      >
        <Image
          src="/FlopShop.webp"
          alt="FlopShop"
          width={size}
          height={size}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      {showText && (
        <span className={cn("text-lg font-extrabold tracking-tight", textClassName)}>
          Flop<span className="text-brand">Shop</span>
        </span>
      )}
    </span>
  );
}
