import { useRef, useEffect } from "react";
import { Calendar } from "lucide-react";
import { getScrollDates } from "../utils/fruit";

// Llista de dates seleccionables filtrada pels dies vàlids de cada lloc.
// Compartida entre crear (wizard) i editar perquè els filtres siguin idèntics.
// onSelect rep una data "YYYY-MM-DD" o el literal "other" (per a una altra data).

const DIES_SCROLL = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];

export default function DateScrollList({ place, selectedDate, onSelect }) {
  const dates = getScrollDates(place);
  const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });
  const [ty, tm, td] = today.split('-').map(Number);
  const tomorrowDt = new Date(Date.UTC(ty, tm - 1, td + 1));
  const tomorrow = `${tomorrowDt.getUTCFullYear()}-${String(tomorrowDt.getUTCMonth() + 1).padStart(2, '0')}-${String(tomorrowDt.getUTCDate()).padStart(2, '0')}`;

  const selectedRef = useRef(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }, []);

  return (
    <div>
      <div
        className="overflow-y-auto rounded-2xl border border-stone-700"
        style={{ maxHeight: "320px", scrollSnapType: "y mandatory" }}
      >
        {dates.map((dateStr) => {
          const isSelected = dateStr === selectedDate;
          const dow = new Date(dateStr + "T00:00:00").getDay();
          const dowName = DIES_SCROLL[dow];
          const [, mm, dd] = dateStr.split('-');
          const datePart = `${parseInt(dd)}/${parseInt(mm)}`;

          let mainLabel;
          if (dateStr === today)
            mainLabel = `Aquest ${dowName.toLowerCase()} (Avui)`;
          else if (dateStr === tomorrow)
            mainLabel = `Aquest ${dowName.toLowerCase()} (Demà)`;
          else
            mainLabel = dowName;

          return (
            <button
              key={dateStr}
              type="button"
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelect(dateStr)}
              className="w-full px-5 py-4 flex items-center justify-between border-b border-stone-800 last:border-b-0 transition-colors active:opacity-80"
              style={{
                scrollSnapAlign: 'start',
                backgroundColor: isSelected ? '#F59E0B' : 'transparent',
              }}
            >
              <span
                className="font-semibold text-base"
                style={{ color: isSelected ? '#1C1917' : '#A8A29E' }}
              >
                {mainLabel}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: isSelected ? '#292524' : '#57534E' }}
              >
                {datePart}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSelect("other")}
        className="w-full mt-2.5 rounded-2xl px-5 py-4 text-left font-semibold text-base transition-all active:scale-[0.98] flex items-center gap-2.5"
        style={{ backgroundColor: "transparent", color: "#A8A29E", border: "1.5px dashed #44403C" }}
      >
        <Calendar className="w-4 h-4 flex-shrink-0" />
        Altra data
      </button>
    </div>
  );
}
