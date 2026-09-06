import { CalendarDays } from "lucide-react";

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function MonthHeatmap({ year, month, selected = [], marked = [], selectable = false, onToggle }) {
  const now = new Date();
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedSet = new Set(selected);
  const markedSet = new Set(marked);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const activeCount = selected.length + marked.filter((day) => !selectedSet.has(day)).length;

  const cellBase = "flex h-3.5 w-3.5 items-center justify-center rounded-[4px] transition-colors";
  const activeClass = "bg-[#0f5132]/85 dark:bg-emerald-500/85";
  const futureClass = isCurrentMonth ? "bg-black/[0.03] dark:bg-white/[0.04]" : "bg-black/5 dark:bg-white/10";
  const emptyClass = "bg-black/5 dark:bg-white/10";

  return (
    <div className="rounded-[22px] bg-white dark:bg-[#181d24] p-5 border border-black/5 dark:border-white/10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[#0f5132] dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-black dark:text-white">{monthLabel}</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-black/45 dark:text-white/45">
          <span>Less</span>
          <span className="h-3 w-3 rounded-[4px] border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/10" />
          <span className="h-3 w-3 rounded-[4px] border border-black/5 dark:border-white/10 bg-[#0f5132]/85 dark:bg-emerald-500/85" />
          <span>More</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((weekday, index) => (
          <span key={index} className="text-[10px] font-semibold uppercase text-black/35 dark:text-white/35">
            {weekday}
          </span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {cells.map((day, index) => {
          if (day === null) {
            return <span key={`blank-${index}`} />;
          }
          const key = dateKey(year, month, day);
          const isSelected = selectedSet.has(key);
          const isMarked = markedSet.has(key);
          const isToday = key === todayKey;
          const isFuture = isCurrentMonth && key > todayKey;
          const active = isSelected || isMarked;
          const title = isSelected
            ? "Going out"
            : isMarked
              ? "Logged"
              : "No activity";

          const content = (
            <div
              title={`${key} — ${title}`}
              className={`${cellBase} ${
                active ? activeClass : isFuture ? futureClass : emptyClass
              } ${isToday ? "ring-2 ring-[#0f5132]/60 dark:ring-emerald-400/60" : ""}`}
            />
          );

          if (selectable) {
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggle?.(key)}
                className="relative flex justify-center focus:outline-none"
                aria-pressed={isSelected}
                title={key}
              >
                {content}
              </button>
            );
          }

          return (
            <span key={key} className="relative flex justify-center">
              {content}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between text-[11px] text-black/40 dark:text-white/40">
        <span>{activeCount} day{activeCount === 1 ? "" : "s"}</span>
        <span>{monthLabel}</span>
      </div>
    </div>
  );
}