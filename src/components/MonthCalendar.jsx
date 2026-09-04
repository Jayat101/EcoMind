function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function MonthCalendar({ year, month, selected = [], marked = [], selectable = false, onToggle }) {
  const now = new Date();
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedSet = new Set(selected);
  const markedSet = new Set(marked);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let index = 0; index < firstDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="text-[10px] font-semibold uppercase text-black/35 dark:text-white/35">
            {weekday}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) {
            return <span key={`blank-${index}`} />;
          }
          const key = dateKey(year, month, day);
          const isSelected = selectedSet.has(key);
          const isMarked = markedSet.has(key);
          const isToday = key === todayKey;

          const content = (
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${
                isSelected ? "bg-emerald-500 font-bold text-white" : "text-black/70 dark:text-white/70"
              } ${isToday && !isSelected ? "ring-1 ring-emerald-500" : ""}`}
            >
              {day}
            </div>
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
                {isMarked && !isSelected ? (
                  <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-amber-400" />
                ) : null}
              </button>
            );
          }

          return (
            <span key={key} className="relative flex justify-center">
              {content}
              {isMarked && !isSelected ? (
                <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-amber-400" />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
