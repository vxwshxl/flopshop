import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function Brand({
  shopName = "FlopShop",
  href = "/",
  className,
  markClassName,
  textClassName,
}: {
  shopName?: string;
  href?: string;
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <Link href={href} className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5",
          markClassName
        )}
      >
        <Image src="/FlopShop.webp" alt="FlopShop logo" fill sizes="36px" className="object-cover" priority />
      </span>
      <span className={cn("truncate text-lg font-extrabold tracking-normal", textClassName)}>
        {shopName}
      </span>
    </Link>
  );
}
