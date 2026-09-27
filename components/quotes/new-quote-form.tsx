"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Quote } from "lucide-react";
import { createQuote, updateQuote } from "@/lib/quotes/actions";
import { ClientSelect } from "@/components/funnel/client-select";

const ink = "text-[#042b3c]";
const line = "border-[#d5dde1]";
const green = "#388623";
const field = `h-11 w-full rounded-lg border ${line} bg-white px-3 text-[15px] ${ink} outline-none placeholder:text-[#667880] focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`;

type Line = { id: string; name: string; qty: string; price: string; description: string };
type Client = { id: string; first_name: string; last_name: string; email: string };

function money(value: number) {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function NewQuoteForm({
  clients,
  requestId,
  quoteId,
  initialClientId,
  initialTitle,
  initialValidUntil,
  initialMessage,
  initialNotes,
  initialLines,
}: {
  clients: Client[];
  requestId?: string;
  quoteId?: string;
  initialClientId?: string;
  initialTitle?: string;
  initialValidUntil?: string;
  initialMessage?: string;
  initialNotes?: string;
  initialLines?: { name: string; description: string; qty: string; unitPrice: string }[];
}) {
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [validUntil, setValidUntil] = useState(initialValidUntil ?? "");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lines, setLines] = useState<Line[]>(
    initialLines?.length
      ? initialLines.map((l, i) => ({
          id: `line-${i}`,
          name: l.name,
          qty: l.qty,
          price: l.unitPrice,
          description: l.description,
        }))
      : [{ id: "line-1", name: "", qty: "1", price: "", description: "" }],
  );

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const qty = Number(line.qty.replace(",", ".")) || 0;
        const price = Number(line.price.replace(",", ".")) || 0;
        return sum + qty * price;
      }, 0),
    [lines],
  );

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        const payload = {
          clientId,
          requestId,
          title,
          message,
          notes,
          validUntil,
          lines: lines.map((l) => ({
            name: l.name,
            description: l.description,
            qty: l.qty,
            unitPrice: l.price,
          })),
        };
        const result = quoteId ? await updateQuote(quoteId, payload) : await createQuote(payload);
        setPending(false);
        if (result && !result.ok) {
          setError(result.message || Object.values(result.errors ?? {})[0] || "Could not save quote.");
        }
      }}
    >
      <div className="flex items-center gap-2">
        <Quote size={18} style={{ color: green }} />
        <h1 className={`text-[26px] font-bold tracking-tight ${ink}`}>
          {quoteId ? "Editar cotação" : "Nova cotação"}
        </h1>
      </div>

      <ClientSelect
        clients={clients}
        value={clientId}
        onChange={setClientId}
        disabled={!!quoteId}
      />

      <label className="block">
        <span className="mb-1 block text-[13px] text-[#5d6f78]">Título</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Moving quote" className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] text-[#5d6f78]">Válida até</span>
        <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={field} />
      </label>

      <section className={`rounded-lg border ${line} bg-white p-4 sm:p-5`}>
        <h2 className={`text-[17px] font-bold ${ink}`}>Produto/Serviço</h2>
        <div className="mt-4 space-y-4">
          {lines.map((line) => {
            const qty = Number(line.qty.replace(",", ".")) || 0;
            const price = Number(line.price.replace(",", ".")) || 0;
            return (
              <div key={line.id} className="space-y-2">
                <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_110px_150px_110px]">
                  <input
                    placeholder="Nome"
                    value={line.name}
                    onChange={(e) =>
                      setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, name: e.target.value } : row)))
                    }
                    className={field}
                  />
                  <input
                    aria-label="Quantidade"
                    value={line.qty}
                    onChange={(e) =>
                      setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, qty: e.target.value } : row)))
                    }
                    className={field}
                  />
                  <input
                    aria-label="Preço unitário"
                    placeholder="£ 0.00"
                    value={line.price}
                    onChange={(e) =>
                      setLines((rows) => rows.map((row) => (row.id === line.id ? { ...row, price: e.target.value } : row)))
                    }
                    className={field}
                  />
                  <div className={`flex h-11 items-center justify-end rounded-lg border ${line} px-3 text-sm ${ink}`}>
                    {money(qty * price)}
                  </div>
                </div>
                <textarea
                  placeholder="Descrição"
                  value={line.description}
                  onChange={(e) =>
                    setLines((rows) =>
                      rows.map((row) => (row.id === line.id ? { ...row, description: e.target.value } : row)),
                    )
                  }
                  className={`min-h-[72px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] ${ink} outline-none`}
                />
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            setLines((rows) => [
              ...rows,
              { id: `line-${Date.now()}`, name: "", qty: "1", price: "", description: "" },
            ])
          }
          className="mt-4 h-9 rounded-lg px-3 text-sm font-semibold text-white"
          style={{ background: green }}
        >
          Adicionar item de linha
        </button>
        <div className={`mt-5 flex justify-end gap-10 border-t ${line} pt-4 font-bold ${ink}`}>
          <span>Total</span>
          <span>{money(subtotal)}</span>
        </div>
      </section>

      <textarea
        placeholder="Mensagem para o cliente"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className={`min-h-[72px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] ${ink} outline-none`}
      />
      <textarea
        placeholder="Notas internas"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className={`min-h-[72px] w-full resize-y rounded-lg border ${line} px-3 py-2 text-[15px] ${ink} outline-none`}
      />

      {error ? <p className="text-sm font-semibold text-rose-700">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Link
          href={quoteId ? `/cotacoes/${quoteId}` : "/cotacoes"}
          className={`inline-flex h-10 items-center rounded-lg border ${line} bg-white px-4 text-sm font-semibold ${ink}`}
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: green }}
        >
          {pending ? "A guardar…" : quoteId ? "Atualizar cotação" : "Guardar cotação"}
        </button>
      </div>
    </form>
  );
}
