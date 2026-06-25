import { useRef, useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { getScrollDates } from "../utils/fruit";
import { MESOS_CA, DIES_CA, capFirst, diaDiff } from "../utils/dates";

// Selector de data tipus roda d'iPhone: l'element centrat és el seleccionat.
// Filtra les dates pels dies vàlids de cada lloc. Compartit entre crear i editar.
// onSelect rep una data "YYYY-MM-DD" (quan la roda s'atura al centre o es toca
// una fila) o el literal "other" (botó "Altra data").

const ITEM_H = 56;   // alçada de cada fila (px) — encabeix títol + subtítol + separador
const VISIBLE = 5;   // files visibles (senar perquè n'hi hagi una al centre)
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
const DIV_H = 15;    // alçada de la franja del separador de mes (a la vora superior)

export default function DateScrollList({ place, selectedDate, onSelect }) {
  const dates = getScrollDates(place);

  const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });

  // Precalcula la presentació de cada fila (un sol recorregut sobre la llista):
  // - subtítol relatiu respecte avui (Avui / Demà / "Aquest {dia}" la primera
  //   ocurrència propera de cada dia de la setmana, només si és a ≤ 14 dies);
  // - separador de mes la primera fila de cada mes nou (amb l'any si també canvia).
  const seenDow = new Set();   // dies de la setmana ja etiquetats com a "Aquest …"
  let prevMonth = null;
  let prevYear  = null;
  const rows = dates.map((dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    const dow = d.getDay();
    const month = d.getMonth();
    const year = d.getFullYear();
    const diff = diaDiff(today, dateStr);

    let subtitle = null;
    if (diff === 0) { subtitle = "Avui"; seenDow.add(dow); }
    else if (diff === 1) { subtitle = "Demà"; seenDow.add(dow); }
    else if (diff >= 2 && diff <= 14 && !seenDow.has(dow)) {
      subtitle = `Aquest ${DIES_CA[dow]}`;
      seenDow.add(dow);
    }

    const monthChanged = month !== prevMonth || year !== prevYear;
    const yearChanged  = year !== prevYear;
    const showDivider  = prevMonth !== null && monthChanged;
    const dividerLabel = showDivider
      ? (yearChanged ? `${MESOS_CA[month]} ${year}` : MESOS_CA[month])
      : null;
    prevMonth = month;
    prevYear = year;

    return {
      dateStr,
      title: `${capFirst(DIES_CA[dow])} ${d.getDate()}`,
      monthName: MESOS_CA[month],
      subtitle,
      dividerLabel,
    };
  });

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
          {rows.map((row, idx) => {
            const isCenter = idx === centerIdx;
            return (
              <button
                key={row.dateStr}
                type="button"
                onClick={() => handleRowClick(idx)}
                className="relative w-full transition-all"
                style={{ height: ITEM_H, scrollSnapAlign: "center" }}
              >
                {/* Separador de mes: línia a la vora superior de la fila (el límit
                    entre mesos), només quan el mes canvia respecte l'anterior. */}
                {row.dividerLabel && (
                  <div
                    className="absolute inset-x-0 top-0 flex items-center px-5 pointer-events-none"
                    style={{ height: DIV_H }}
                  >
                    <span
                      className="font-semibold uppercase whitespace-nowrap"
                      style={{ fontSize: "0.6rem", color: "#78716C", letterSpacing: "0.08em" }}
                    >
                      {row.dividerLabel}
                    </span>
                    <span className="flex-1 ml-2" style={{ height: 1, backgroundColor: "#44403C" }} />
                  </div>
                )}

                {/* Contingut: títol (dia + número) amb subtítol relatiu opcional,
                    i el mes en lletra a la dreta. Centrat dins la fila sencera. */}
                <div className="absolute inset-0 flex items-center justify-between px-5">
                  <div className="flex flex-col items-start min-w-0">
                    <span
                      className="font-semibold truncate transition-all"
                      style={{
                        fontSize: isCenter ? "1.05rem" : "0.9rem",
                        color: isCenter ? "#F8FAFC" : "#78716C",
                        opacity: isCenter ? 1 : 0.7,
                        lineHeight: 1.15,
                      }}
                    >
                      {row.title}
                    </span>
                    {row.subtitle && (
                      <span
                        className="font-medium truncate transition-all"
                        style={{
                          fontSize: isCenter ? "0.72rem" : "0.66rem",
                          color: isCenter ? "#FBBF24" : "#57534E",
                          opacity: isCenter ? 0.9 : 0.7,
                          lineHeight: 1.1,
                        }}
                      >
                        {row.subtitle}
                      </span>
                    )}
                  </div>
                  <span
                    className="font-medium transition-all whitespace-nowrap"
                    style={{
                      fontSize: isCenter ? "0.85rem" : "0.78rem",
                      color: isCenter ? "#FBBF24" : "#57534E",
                    }}
                  >
                    {row.monthName}
                  </span>
                </div>
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
