"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function NewQuoteDialog({
  services,
  clientId,
  requestId,
}: {
  services: { id: string; name: string }[];
  clientId?: string;
  requestId?: string;
}) {
  const router = useRouter();
  const closeHref = requestId
    ? `/solicitacoes/${requestId}`
    : clientId
      ? `/clientes/${clientId}`
      : "/cotacoes";

  const close = () => router.push(closeHref);

  function continueWith(serviceId: string) {
    const params = new URLSearchParams();
    params.set("service", serviceId);
    if (clientId) params.set("clientId", clientId);
    if (requestId) params.set("requestId", requestId);
    router.push(`/cotacoes/novo?${params.toString()}`);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(closeHref);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, closeHref]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#123035]/45 p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-quote-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white px-6 py-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h1 id="new-quote-title" className="text-[28px] font-bold tracking-tight text-[#042b3c]">
            New quote
          </h1>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-lg text-[#5d6f78] hover:bg-[#f4f6f7]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-[#d5dde1]">
          <p className="border-b border-[#e6ebed] px-4 py-3.5 text-[15px] font-bold text-[#042b3c]">
            Services
          </p>
          {services.length === 0 ? (
            <div className="px-4 py-6 text-[15px] text-[#1c3d46]">
              <p>You haven&apos;t created any services yet.</p>
              <Link
                href="/produtos-servicos"
                className="mt-2 inline-block font-semibold text-[#388623] hover:underline"
              >
                Create a service
              </Link>
            </div>
          ) : (
            services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => continueWith(service.id)}
                className="block w-full border-b border-[#e6ebed] px-4 py-4 text-left text-[15px] text-[#1c3d46] last:border-b-0 hover:bg-[#e7f3e3] hover:font-semibold hover:text-[#042b3c]"
              >
                {service.name}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
