import Link from "next/link";

const WHATSAPP_URL =
  "https://wa.me/918133860088?text=" + encodeURIComponent("Hi FlopShop! I'd like to know more.");

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

export function Footer({ shopName = "FlopShop" }: { shopName?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
        {/* Bottom utility row */}
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <p className="order-3 text-xs text-white/40 sm:order-1">© {year} FlopShop.</p>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            className="order-1 grid h-11 w-11 place-items-center rounded-full bg-white/5 text-white transition hover:bg-lime-400 hover:text-black sm:order-2"
          >
            <WhatsAppIcon className="h-5 w-5" />
          </a>

          <Link href="/privacy" className="order-2 text-xs text-white/40 transition hover:text-white sm:order-3">
            Privacy Policy
          </Link>
        </div>

        {/* Giant brand wordmark */}
        <div className="select-none pt-10 text-center leading-[0.8]">
          <span className="inline-block align-top text-[22vw] font-black tracking-tighter">
            <span className="text-lime-400">Flop</span>
            <span className="text-white">Shop</span>
            <sup className="ml-1 align-top text-[4vw] font-bold text-white/60">™</sup>
          </span>
        </div>
      </div>
    </footer>
  );
}
