"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

const TEMPLATES = [
  "Motorista + Ajudante",
  "Somente motorista",
  "Serviço de descarte de entulho",
  "Preço fixo",
  "Serviço de ajuda",
  "Mudança de escritório",
  "Serviço de Embalagem",
  "Serviço de Piano",
];

export function NewQuoteDialog() {
  const router = useRouter();
  const close = () => router.push("/cotacoes");

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.push("/cotacoes");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

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
            Nova citação
          </h1>
          <button
            type="button"
            onClick={close}
            aria-label="Fechar"
            className="grid h-9 w-9 place-items-center rounded-lg text-[#5d6f78] hover:bg-[#f4f6f7]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-[#d5dde1]">
          <p className="border-b border-[#e6ebed] px-4 py-3.5 text-[15px] font-bold text-[#042b3c]">
            Usar modelo
          </p>
          {TEMPLATES.map((name) => (
            <button
              key={name}
              type="button"
              className="block w-full border-b border-[#e6ebed] px-4 py-4 text-left text-[15px] text-[#1c3d46] last:border-b-0 hover:bg-[#f7f8f8]"
            >
              {name}
            </button>
          ))}
        </div>

        <div className="my-5 flex items-center gap-4 text-sm text-[#8aa0a8]">
          <span className="h-px flex-1 bg-[#e6ebed]" />
          ou
          <span className="h-px flex-1 bg-[#e6ebed]" />
        </div>

        <button
          type="button"
          className="h-12 w-full rounded-lg text-[15px] font-semibold text-white"
          style={{ background: "#388623" }}
        >
          Criar novo orçamento
        </button>
      </div>
    </div>
  );
}
