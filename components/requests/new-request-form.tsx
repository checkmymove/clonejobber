"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Calendar, ChevronDown, Search, Upload, UserRound } from "lucide-react";
import { HOURS_OPTIONS } from "@/lib/requests/constants";
import { createAdminRequest } from "@/lib/requests/actions";
import { ClientSelect } from "@/components/funnel/client-select";

const ink = "text-[#042b3c]";
const line = "border-[#d5dde1]";
const green = "#388623";
const ph = "placeholder:text-[#667880]";

const field = `h-12 w-full rounded-lg border ${line} bg-white px-3 text-[15px] ${ink} outline-none ${ph} focus:border-[#388623] focus:ring-2 focus:ring-[#388623]/20`;

const picker =
  "[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div>
      <p className={`text-sm ${ink}`}>{label}</p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className="relative mt-2 h-6 w-11 rounded-full transition-colors"
        style={{ background: on ? green : "#d7dee2" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: on ? 22 : 2 }}
        />
      </button>
    </div>
  );
}

function Dropzone({ text }: { text: string }) {
  return (
    <button
      type="button"
      className={`flex min-h-[168px] w-full flex-col items-center justify-center rounded-lg border border-dashed ${line} bg-white px-6 py-10 text-center hover:bg-[#fafbfb]`}
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f3f5f6] text-[#8aa0a8]">
        <Upload size={18} />
      </span>
      <span className="mt-3 max-w-md text-sm text-[#7b8e96]">{text}</span>
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={`text-[17px] font-bold ${ink}`}>{children}</h2>;
}

export function NewRequestForm({
  services,
  clients,
}: {
  services: { id: string; name: string }[];
  clients: { id: string; first_name: string; last_name: string; email: string }[];
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [requestedDate, setRequestedDate] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [moveTime, setMoveTime] = useState("");
  const [pickup, setPickup] = useState({
    address: "",
    postcode: "",
    floor: "",
    lift: true,
    notes: "",
    bedrooms: "",
  });
  const [delivery, setDelivery] = useState({
    address: "",
    postcode: "",
    floor: "",
    lift: true,
    notes: "",
    destination: "",
  });
  const [needsPacking, setNeedsPacking] = useState(true);
  const [needsBoxes, setNeedsBoxes] = useState(true);
  const [serviceId, setServiceId] = useState("");
  const [hours, setHours] = useState("");
  const [inventory, setInventory] = useState("");
  const [lines, setLines] = useState<{ id: string; name: string; qty: string; price: string }[]>([]);

  const money = useMemo(() => {
    const sub = lines.reduce((sum, line) => {
      const qty = Number(line.qty.replace(",", ".")) || 0;
      const price = Number(line.price.replace(",", ".")) || 0;
      return sum + qty * price;
    }, 0);
    return sub.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
  }, [lines]);

  return (
    <form
      className="mt-6 space-y-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        setPending(true);
        const result = await createAdminRequest({
          clientId,
          title,
          moveDate,
          moveTime,
          pickupAddress: pickup.address,
          pickupPostcode: pickup.postcode,
          pickupFloor: pickup.floor,
          pickupLift: pickup.lift,
          pickupParking: pickup.notes,
          pickupBedrooms: pickup.bedrooms,
          deliveryAddress: delivery.address,
          deliveryPostcode: delivery.postcode,
          deliveryFloor: delivery.floor,
          deliveryLift: delivery.lift,
          deliveryParking: delivery.notes,
          deliveryBedrooms: pickup.bedrooms,
          needsPacking,
          needsBoxes,
          serviceId,
          hours,
          inventory,
        });
        setPending(false);
        if (result && !result.ok) {
          setError(result.message || Object.values(result.errors ?? {})[0] || "Could not save request.");
        }
      }}
    >
      <input
        aria-label="Título"
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={field}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <ClientSelect clients={clients} value={clientId} onChange={setClientId} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-semibold text-[#5d6f78]">Solicitado em</span>
            <span className="relative block">
              <input
                aria-label="Solicitado em"
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
                className={`${field} ${picker} relative pr-10`}
              />
              <Calendar
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5d6f78]"
              />
            </span>
          </label>
          <label className="relative block">
            <UserRound
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5d6f78]"
            />
            <select
              aria-label="Vendedor"
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              className={`${field} appearance-none pl-9 pr-10 ${salesperson ? "" : "text-[#667880]"}`}
            >
              <option value="">Selecionar vendedor</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#042b3c]"
            />
          </label>
        </div>
      </div>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Visão geral</SectionTitle>
        <div>
          <h3 className={`text-[15px] font-bold ${ink}`}>Informações de contato</h3>
          <p className="mt-1 text-[13px] leading-5 text-[#7b8e96]">
            Este será o contato principal desta solicitação.
          </p>
        </div>
        <label className="relative block">
          <input
            aria-label="Data"
            placeholder="Data"
            value={moveDate}
            onChange={(e) => setMoveDate(e.target.value)}
            className={`${field} pr-10`}
          />
          <Calendar
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5d6f78]"
          />
        </label>
        <input
          aria-label="Tempo de mudança"
          placeholder="Tempo de mudança"
          value={moveTime}
          onChange={(e) => setMoveTime(e.target.value)}
          className={field}
        />
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Informações da coleta</SectionTitle>
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa0a8]"
          />
          <input
            aria-label="Endereço de coleta"
            placeholder="Endereço de coleta"
            value={pickup.address}
            onChange={(e) => setPickup((p) => ({ ...p, address: e.target.value }))}
            className={`${field} pl-9`}
          />
        </label>
        <input
          aria-label="Código postal"
          placeholder="Código postal"
          value={pickup.postcode}
          onChange={(e) => setPickup((p) => ({ ...p, postcode: e.target.value }))}
          className={field}
        />
        <input
          aria-label="Andar"
          placeholder="Andar (Ex: Térreo ou 1º)"
          value={pickup.floor}
          onChange={(e) => setPickup((p) => ({ ...p, floor: e.target.value }))}
          className={field}
        />
        <Toggle
          label="Elevador"
          on={pickup.lift}
          onChange={(lift) => setPickup((p) => ({ ...p, lift }))}
        />
        <input
          aria-label="Instruções para o motorista"
          placeholder="Instruções para o motorista"
          value={pickup.notes}
          onChange={(e) => setPickup((p) => ({ ...p, notes: e.target.value }))}
          className={field}
        />
        <input
          aria-label="Quartos na coleta"
          placeholder="E quantos quartos você vai se mudar?"
          value={pickup.bedrooms}
          onChange={(e) => setPickup((p) => ({ ...p, bedrooms: e.target.value }))}
          className={field}
        />
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Informações sobre a entrega</SectionTitle>
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa0a8]"
          />
          <input
            aria-label="Endereço de entrega"
            placeholder="Endereço de entrega"
            value={delivery.address}
            onChange={(e) => setDelivery((d) => ({ ...d, address: e.target.value }))}
            className={`${field} pl-9`}
          />
        </label>
        <input
          aria-label="Código postal da entrega"
          placeholder="Código postal"
          value={delivery.postcode}
          onChange={(e) => setDelivery((d) => ({ ...d, postcode: e.target.value }))}
          className={field}
        />
        <input
          aria-label="Andar da entrega"
          placeholder="Andar (Ex: Térreo ou 1º)"
          value={delivery.floor}
          onChange={(e) => setDelivery((d) => ({ ...d, floor: e.target.value }))}
          className={field}
        />
        <Toggle
          label="Elevador"
          on={delivery.lift}
          onChange={(lift) => setDelivery((d) => ({ ...d, lift }))}
        />
        <input
          aria-label="Instruções para o motorista na entrega"
          placeholder="Instruções para o motorista"
          value={delivery.notes}
          onChange={(e) => setDelivery((d) => ({ ...d, notes: e.target.value }))}
          className={field}
        />
        <input
          aria-label="Destino"
          placeholder="Para qual endereço você vai se mudar?"
          value={delivery.destination}
          onChange={(e) => setDelivery((d) => ({ ...d, destination: e.target.value }))}
          className={field}
        />
      </section>

      <section className="space-y-5 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Serviço de Embalagem</SectionTitle>
        <Toggle
          label="Você vai precisar de embalagem?"
          on={needsPacking}
          onChange={setNeedsPacking}
        />
        <Toggle
          label="Você precisa de caixas para embalagem?"
          on={needsBoxes}
          onChange={setNeedsBoxes}
        />
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Detalhes do serviço</SectionTitle>
        <label className="relative block">
          <span className="mb-1.5 block text-sm text-[#5d6f78]">Qual serviço você precisa?</span>
          <select
            aria-label="Qual serviço você precisa?"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={`${field} appearance-none pr-10 ${serviceId ? "" : "text-[#667880]"}`}
          >
            <option value="">Selecione as opções</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute bottom-4 right-3 text-[#042b3c]"
          />
        </label>
        <label className="relative block">
          <span className="mb-1.5 block text-sm text-[#5d6f78]">E quantas horas você precisa?</span>
          <select
            aria-label="E quantas horas você precisa?"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={`${field} appearance-none pr-10 ${hours ? "" : "text-[#667880]"}`}
          >
            <option value="">Selecione as opções</option>
            {HOURS_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute bottom-4 right-3 text-[#042b3c]"
          />
        </label>
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Lista de inventário</SectionTitle>
        <div className={`overflow-hidden rounded-lg border ${line} bg-white`}>
          <textarea
            aria-label="Lista de inventário"
            placeholder="Por favor, forneça o máximo de informações possível."
            value={inventory}
            maxLength={500}
            onChange={(e) => setInventory(e.target.value)}
            className={`min-h-[120px] w-full resize-y border-0 bg-transparent px-3 py-3 text-[15px] ${ink} outline-none ${ph}`}
          />
          <div className="flex justify-end px-3 pb-2 text-xs text-[#8aa0a8]">
            {inventory.length}/500
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-9 rounded-lg px-3 text-sm font-semibold text-white"
            style={{ background: green }}
          >
            Selecione as imagens
          </button>
        </div>
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Avaliação no local</SectionTitle>
        <Dropzone text="Visite o imóvel para avaliar o trabalho antes de começar." />
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Produto/Serviço</SectionTitle>
        <p className="text-[13px] text-[#7b8e96]">
          Mantenha tudo organizado adicionando produtos e serviços.
        </p>
        <button
          type="button"
          onClick={() =>
            setLines((rows) => [
              ...rows,
              { id: crypto.randomUUID(), name: "", qty: "1", price: "" },
            ])
          }
          className="h-9 rounded-lg px-3 text-sm font-semibold text-white"
          style={{ background: green }}
        >
          Adicionar item de linha
        </button>
        {lines.length > 0 ? (
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-[1fr_72px_110px_auto] gap-2">
                <input
                  aria-label="Item"
                  placeholder="Item"
                  value={line.name}
                  onChange={(e) =>
                    setLines((rows) =>
                      rows.map((r) => (r.id === line.id ? { ...r, name: e.target.value } : r)),
                    )
                  }
                  className={field}
                />
                <input
                  aria-label="Qtd"
                  placeholder="Qtd"
                  value={line.qty}
                  onChange={(e) =>
                    setLines((rows) =>
                      rows.map((r) => (r.id === line.id ? { ...r, qty: e.target.value } : r)),
                    )
                  }
                  className={field}
                />
                <input
                  aria-label="Preço"
                  placeholder="£"
                  value={line.price}
                  onChange={(e) =>
                    setLines((rows) =>
                      rows.map((r) => (r.id === line.id ? { ...r, price: e.target.value } : r)),
                    )
                  }
                  className={field}
                />
                <button
                  type="button"
                  onClick={() => setLines((rows) => rows.filter((r) => r.id !== line.id))}
                  className="px-2 text-xs font-bold text-rose-700"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="space-y-2 border-t border-[#e6ebed] pt-4 text-sm">
          <div className="flex items-center justify-end gap-16 text-[#5d6f78]">
            <span>Subtotal</span>
            <span className="w-16 text-right">{money}</span>
          </div>
          <div className={`flex items-center justify-end gap-16 font-bold ${ink}`}>
            <span>Total</span>
            <span className="w-16 text-right">{money}</span>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-[#e6ebed] pt-8">
        <SectionTitle>Notas</SectionTitle>
        <Dropzone text="Deixe um recado interno para você ou para o time ver nesta solicitação." />
      </section>

      <div className="flex items-center justify-end gap-2 border-t border-[#e6ebed] pt-6">
        {error ? <p className="mr-auto text-sm font-semibold text-rose-700">{error}</p> : null}
        <Link
          href="/solicitacoes"
          className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold ${ink} hover:bg-[#f4f6f7]`}
        >
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: green }}
        >
          {pending ? "A guardar…" : "Guardar solicitação"}
        </button>
      </div>
    </form>
  );
}
