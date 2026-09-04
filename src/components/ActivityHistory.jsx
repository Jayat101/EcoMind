import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Car, Clock, Download, Flame, Leaf, Package, Pencil, Recycle, Snowflake, Sparkles, Trash2, Utensils, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { buildHeatmap, getStreak, heatLevel } from "../services/streak.js";

function formatVehicle(type) {
  const map = {
    walk: "Walk",
    bicycle: "Bicycle",
    bus: "Public Transit / Bus",
    ev: "Electric Vehicle (EV)",
    motorbike: "Motorbike",
    gasoline_car: "Gasoline Car"
  };
  return map[type] ?? type;
}

function formatDiet(type) {
  const map = {
    none: "Not Logged",
    vegan: "Vegan Meal",
    vegetarian: "Vegetarian Meal",
    mixed: "Balanced / Mixed",
    meat_heavy: "Meat Heavy"
  };
  return map[type] ?? type;
}

function formatAppliance(type) {
  const map = {
    none: "Standard Usage",
    laundry: "Laundry Dryer",
    water_heater: "Geyser / Water Heater",
    both: "Heavy Appliances (Dryer & Geyser)"
  };
  return map[type] ?? type;
}

function formatGoods(type) {
  const map = {
    none: "No New Goods",
    general: "General Retail Goods",
    clothing: "Clothing / Fashion Item",
    electronics: "Electronics / Gadget"
  };
  return map[type] ?? type;
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCSV(entries) {
  const header = [
    "date", "transportation", "distance_km", "transport_emissions_kg",
    "ac_hours", "appliance", "energy_emissions_kg",
    "diet", "takeout_meals", "goods", "recycled", "lifestyle_emissions_kg",
    "total_kg_co2e", "source"
  ];

  const rows = entries.map((entry) => {
    const transport = entry.transportation ?? {};
    const energy = entry.energy ?? {};
    const lifestyle = entry.lifestyle ?? {};
    return [
      entry.date,
      formatVehicle(transport.vehicleType),
      transport.distanceKm ?? 0,
      transport.emissionsKg ?? 0,
      energy.acHours ?? 0,
      formatAppliance(energy.heavyAppliance),
      energy.emissionsKg ?? 0,
      formatDiet(lifestyle.dietType),
      lifestyle.takeoutMeals ?? 0,
      formatGoods(lifestyle.newGoodsPurchased),
      lifestyle.recycledOrComposted ? "yes" : "no",
      lifestyle.emissionsKg ?? 0,
      entry.totalEmissionsKg ?? 0,
      entry.source ?? "logged"
    ];
  });

  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ecomind-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function StreakSummary({ entries, frozenDays = [] }) {
  const streak = useMemo(() => getStreak(entries, frozenDays), [entries, frozenDays]);

  const items = [
    { label: "Current streak", value: streak.currentStreak, unit: streak.currentStreak === 1 ? "day" : "days", icon: Flame },
    { label: "Best streak", value: streak.bestStreak, unit: streak.bestStreak === 1 ? "day" : "days", icon: Sparkles },
    { label: "Total days logged", value: streak.loggedDays, unit: streak.loggedDays === 1 ? "day" : "days", icon: CalendarDays }
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-[22px] bg-[#f7faf5] dark:bg-[#181d24] p-4 border border-black/5 dark:border-white/10"
            >
              <div className="flex items-center gap-2 text-[#0f5132] dark:text-emerald-400">
                <Icon size={15} />
                <p className="text-xs font-semibold uppercase tracking-wide text-black/55 dark:text-white/55">{item.label}</p>
              </div>
              <p className="mt-2 text-3xl font-bold leading-none text-black dark:text-white">{item.value}</p>
              <p className="mt-1 text-xs text-black/45 dark:text-white/45">{item.unit}</p>
            </div>
          );
        })}
      </div>
      {(frozenDays.length > 0 || streak.currentStreak > streak.loggedDays) && (
        <div className="flex flex-wrap items-center gap-2 rounded-[22px] bg-[#0f5132]/5 dark:bg-emerald-500/10 border border-[#0f5132]/15 dark:border-emerald-500/20 px-4 py-3">
          <Snowflake size={15} className="shrink-0 text-[#0f5132] dark:text-emerald-400" />
          <p className="text-xs text-black/60 dark:text-white/70">
            <span className="font-semibold text-[#0f5132] dark:text-emerald-400">{frozenDays.length}</span>{" "}
            {frozenDays.length === 1 ? "day is" : "days are"} protected by a Streak Freeze
            {frozenDays.length > 0 ? ` (${frozenDays.join(", ")})` : ""}
            {streak.currentStreak > streak.loggedDays ? " — your current streak is still counting." : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function CalendarHeatmap({ entries }) {
  const { weeks } = useMemo(() => buildHeatmap(entries), [entries]);

  const levelClass = {
    low: "bg-emerald-300/70 dark:bg-emerald-400/50",
    mid: "bg-emerald-500/70 dark:bg-emerald-500/70",
    high: "bg-[#0f5132] dark:bg-emerald-600",
    "very-high": "bg-[#0b3d26] dark:bg-emerald-700"
  };

  return (
    <div className="rounded-[22px] bg-white dark:bg-[#181d24] p-5 border border-black/5 dark:border-white/10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[#0f5132] dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-black dark:text-white">Activity calendar</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-black/45 dark:text-white/45">
          <span>Less</span>
          {[null, "low", "mid", "high", "very-high"].map((level) => (
            <span
              key={level ?? "empty"}
              className={`h-3 w-3 rounded-[4px] border border-black/5 dark:border-white/10 ${level ? levelClass[level] : "bg-black/5 dark:bg-white/10"}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid shrink-0 grid-rows-7 gap-1.5">
            {week.map((cell) => {
              const level = cell.isFuture ? null : heatLevel(cell.emissionsKg);
              const title = cell.logged
                ? `${cell.date} — ${cell.emissionsKg} kg CO2e`
                : `${cell.date} — no activity`;
              return (
                <div
                  key={cell.date}
                  title={title}
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] transition-colors ${
                    cell.isFuture
                      ? "bg-black/[0.03] dark:bg-white/[0.04]"
                      : level
                        ? levelClass[level]
                        : "bg-black/5 dark:bg-white/10"
                  } ${cell.isToday ? "ring-2 ring-[#0f5132]/60 dark:ring-emerald-400/60" : ""}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-between text-[11px] text-black/40 dark:text-white/40">
        <span>{weeks.length} weeks of activity</span>
        <span>Last 12 weeks</span>
      </div>
    </div>
  );
}

export default function ActivityHistory({ entries = [], frozenDays = [], maxItems, showHeader = true, onEdit, onDelete }) {
  const displayEntries = maxItems ? entries.slice(0, maxItems) : entries;
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  if (!entries || entries.length === 0) {
    return (
      <div className="workspace-card h-full flex flex-col items-center justify-center p-8 text-center border border-dashed border-black/15 dark:border-white/15">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0f5132]/10 dark:bg-emerald-500/20 text-[#0f5132] dark:text-emerald-400 mb-3">
          <Clock size={28} />
        </div>
        <h3 className="text-xl font-semibold text-black dark:text-white">No Activity Logged Yet</h3>
        <p className="mt-1 max-w-sm text-sm text-black/50 dark:text-white/50">
          When you submit daily check-ins using the log form, your detailed activity history and category breakdown will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="workspace-card space-y-4">
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="field-label">Activity Log</p>
            <h2 className="mt-1 text-2xl font-medium text-black dark:text-white">Logged History</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#15171b] dark:bg-emerald-600 px-3.5 py-1 text-xs font-semibold text-white">
              {entries.length} {entries.length === 1 ? "Entry" : "Entries"}
            </span>
            <button
              type="button"
              onClick={() => exportCSV(entries)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-[#222832] px-3.5 text-xs font-semibold text-black/70 dark:text-white/80 transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </div>
      )}

      <StreakSummary entries={entries} frozenDays={frozenDays} />
      <CalendarHeatmap entries={entries} />

      <div className="space-y-3">
        <AnimatePresence>
          {displayEntries.map((entry, index) => {
            const transport = entry.transportation ?? {};
            const energy = entry.energy ?? {};
            const lifestyle = entry.lifestyle ?? {};
            const entryId = entry.id ?? `${entry.date}-${index}`;
            const isConfirming = confirmingDeleteId === entryId;

            return (
              <motion.article
                key={entryId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-[24px] bg-white dark:bg-[#222832] p-5 shadow-[0_10px_28px_rgba(20,22,26,0.04)] dark:shadow-none border border-black/5 dark:border-white/10"
              >
                {/* Entry Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0f5132]/10 dark:bg-emerald-500/20 text-[#0f5132] dark:text-emerald-400">
                      <Leaf size={16} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-black dark:text-white">{entry.date}</p>
                      <p className="text-[11px] text-black/45 dark:text-white/45 capitalize">{entry.source ?? "Logged"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-[#15171b] dark:bg-emerald-600 px-3.5 py-1 text-xs font-semibold text-white">
                      {entry.totalEmissionsKg ?? 0} kg CO2e
                    </div>
                    {onEdit ? (
                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        title="Edit entry"
                        aria-label="Edit entry"
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 dark:border-white/15 text-black/60 dark:text-white/70 transition hover:bg-[#0f5132] hover:text-white dark:hover:bg-emerald-600"
                      >
                        <Pencil size={13} />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isConfirming) {
                            setConfirmingDeleteId(null);
                            onDelete(entry);
                          } else {
                            setConfirmingDeleteId(entryId);
                          }
                        }}
                        title={isConfirming ? "Click again to confirm" : "Delete entry"}
                        aria-label="Delete entry"
                        className={`flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition ${
                          isConfirming
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-black/10 dark:border-white/15 text-red-500 hover:bg-red-500 hover:text-white"
                        }`}
                      >
                        <Trash2 size={13} />
                        {isConfirming ? "Confirm" : ""}
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Entry Activity Breakdown */}
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  {/* Transport Details */}
                  {Number(transport.distanceKm) > 0 || transport.vehicleType !== "walk" ? (
                    <div className="flex items-center gap-2 rounded-xl bg-[#f7faf5] dark:bg-[#181d24] p-2.5">
                      <Car size={15} className="shrink-0 text-[#0f5132] dark:text-emerald-400" />
                      <span className="truncate text-black/75 dark:text-white/80">
                        <strong className="font-semibold text-black dark:text-white">{transport.distanceKm ?? 0} km</strong> ({formatVehicle(transport.vehicleType)})
                      </span>
                    </div>
                  ) : null}

                  {/* Energy Details */}
                  {Number(energy.acHours) > 0 || energy.heavyAppliance !== "none" ? (
                    <div className="flex items-center gap-2 rounded-xl bg-[#f7faf5] dark:bg-[#181d24] p-2.5">
                      <Zap size={15} className="shrink-0 text-[#0f5132] dark:text-emerald-400" />
                      <span className="truncate text-black/75 dark:text-white/80">
                        <strong className="font-semibold text-black dark:text-white">{energy.acHours ?? 0}h AC</strong> • {formatAppliance(energy.heavyAppliance)}
                      </span>
                    </div>
                  ) : null}

                  {/* Food & Diet Details */}
                  {lifestyle.dietType !== "none" || Number(lifestyle.takeoutMeals) > 0 ? (
                    <div className="flex items-center gap-2 rounded-xl bg-[#f7faf5] dark:bg-[#181d24] p-2.5">
                      <Utensils size={15} className="shrink-0 text-[#0f5132] dark:text-emerald-400" />
                      <span className="truncate text-black/75 dark:text-white/80">
                        <strong className="font-semibold text-black dark:text-white">{formatDiet(lifestyle.dietType)}</strong>
                        {Number(lifestyle.takeoutMeals) > 0 ? ` (${lifestyle.takeoutMeals} takeout)` : ""}
                      </span>
                    </div>
                  ) : null}

                  {/* Purchases & Retail */}
                  {lifestyle.newGoodsPurchased !== "none" ? (
                    <div className="flex items-center gap-2 rounded-xl bg-[#f7faf5] dark:bg-[#181d24] p-2.5">
                      <Package size={15} className="shrink-0 text-[#0f5132] dark:text-emerald-400" />
                      <span className="truncate text-black/75 dark:text-white/80">{formatGoods(lifestyle.newGoodsPurchased)}</span>
                    </div>
                  ) : null}
                </div>

                {/* Eco Habit Badge */}
                {lifestyle.recycledOrComposted ? (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#0f5132]/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-[#0f5132] dark:text-emerald-400">
                    <Recycle size={13} /> Recycled / Composted (-0.5 kg discount applied)
                  </div>
                ) : null}

                {/* Optional User Notes */}
                {entry.notes ? (
                  <div className="mt-3 rounded-xl bg-black/5 dark:bg-white/5 p-2.5 text-xs text-black/70 dark:text-white/70 italic">
                    "{entry.notes}"
                  </div>
                ) : null}
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
