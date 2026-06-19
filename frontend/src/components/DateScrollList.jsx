import { useRef, useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { getScrollDates } from "../utils/fruit";

// Selector de data tipus roda d'iPhone: l'element centrat és el seleccionat.
// Filtra les dates pels dies vàlids de cada lloc. Compartit entre crear i editar.
// onSelect rep una data "YYYY-MM-DD" (quan la roda s'atura al centre o es toca
// una fila) o el literal "other" (botó "Altra data").

const DIES_SCROLL = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];

const ITEM_H = 36;   // alçada de cada fila (px)
const VISIBLE = 5;   // files visibles (senar perquè n'hi hagi una al centre)
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

export default function DateScrollList({ place, selectedDate, onSelect }) {
  const dates = getScrollDates(place);

  const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });
  const [ty, tm, td] = today.split('-').map(Number);
  const tomorrowDt = new Date(Date.UTC(ty, tm - 1, td + 1));
  const tomorrow = `${tomorrowDt.getUTCFullYear()}-${String(tomorrowDt.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowDt.getUTCDate()).padStart(2, '0')}`;

  const scrollRef   = useRef(null);
  const interacted  = useRef(false);   // distingeix scroll de l'usuari vs programàtic
  const settleTimer = useRef(null);
  const rafId       = useRef(null);

  const initialIdx = Math.max(0, dates.indexOf(selectedDate));
  const [centerIdx, setCenterIdx] = useState(initialIdx);

  // En muntar o en canviar de lloc (canvien les dates disponibles):
  // - si no hi ha data triada, agafem la primera disponible (una roda sempre té
  //   un valor centrat), com fa un selector d'iPhone;
  // - si ja n'hi ha una, la centrem sense disparar onSelect (no la sobreescrivim,
  //   encara que sigui una data inusual fora de la llista).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    interacted.current = false;
    if (!selectedDate && dates.length) {
      el.scrollTop = 0;
      setCenterIdx(0);
      onSelect(dates[0]);
      return;
    }
    const idx = Math.max(0, dates.indexOf(selectedDate));
    el.scrollTop = idx * ITEM_H;
    setCenterIdx(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);

  const markInteracted = () => { interacted.current = true; };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Actualitza quina fila està al centre (visual) de forma fluida.
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const idx = Math.max(0, Math.min(dates.length - 1, Math.round(el.scrollTop / ITEM_H)));
      setCenterIdx(idx);
    });
    // En aturar-se, si l'usuari ha interaccionat, selecciona la data centrada.
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (!interacted.current) return;
      interacted.current = false;
      const idx = Math.max(0, Math.min(dates.length - 1, Math.round(el.scrollTop / ITEM_H)));
      const d = dates[idx];
      if (d && d !== selectedDate) onSelect(d);
    }, 120);
  };

  const handleRowClick = (idx) => {
    interacted.current = false;
    scrollRef.current?.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
    setCenterIdx(idx);
    if (dates[idx] !== selectedDate) onSelect(dates[idx]);
  };

  return (
    <div>
      <div className="relative">
        {/* Banda de selecció centrada */}
        <div
          className="absolute inset-x-0 pointer-events-none rounded-lg"
          style={{ top: PAD, height: ITEM_H, backgroundColor: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.45)" }}
        />
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onPointerDown={markInteracted}
          onTouchStart={markInteracted}
          onWheel={markInteracted}
          className="overflow-y-auto rounded-2xl border border-stone-700 bg-stone-900/40 no-scrollbar"
          style={{
            height: VISIBLE * ITEM_H,
            scrollSnapType: "y mandatory",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)",
            maskImage: "linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)",
          }}
        >
          <div style={{ height: PAD }} />
          {dates.map((dateStr, idx) => {
            const isCenter = idx === centerIdx;
            const dow = new Date(dateStr + "T00:00:00").getDay();
            const dowName = DIES_SCROLL[dow];
            const [, mm, dd] = dateStr.split('-');
            const datePart = `${parseInt(dd)}/${parseInt(mm)}`;

            let mainLabel;
            if (dateStr === today)        mainLabel = `Aquest ${dowName.toLowerCase()} (Avui)`;
            else if (dateStr === tomorrow) mainLabel = `Aquest ${dowName.toLowerCase()} (Demà)`;
            else                           mainLabel = dowName;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleRowClick(idx)}
                className="w-full flex items-center justify-between px-5 transition-all"
                style={{ height: ITEM_H, scrollSnapAlign: "center" }}
              >
                <span
                  className="font-semibold truncate transition-all"
                  style={{
                    fontSize: isCenter ? "0.95rem" : "0.85rem",
                    color: isCenter ? "#F8FAFC" : "#78716C",
                    opacity: isCenter ? 1 : 0.7,
                  }}
                >
                  {mainLabel}
                </span>
                <span
                  className="font-medium transition-all"
                  style={{
                    fontSize: isCenter ? "0.9rem" : "0.8rem",
                    color: isCenter ? "#FBBF24" : "#57534E",
                  }}
                >
                  {datePart}
                </span>
              </button>
            );
          })}
          <div style={{ height: PAD }} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelect("other")}
        className="w-full mt-2.5 rounded-2xl px-5 py-2.5 text-left font-semibold text-sm transition-all active:scale-[0.98] flex items-center gap-2.5"
        style={{ backgroundColor: "transparent", color: "#A8A29E", border: "1.5px dashed #44403C" }}
      >
        <Calendar className="w-4 h-4 flex-shrink-0" />
        Altra data
      </button>
    </div>
  );
}
