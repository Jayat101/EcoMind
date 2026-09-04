import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Minus, Pencil, Plus, Recycle, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { logCarbonEntry, updateCarbonEntry } from "../services/api.js";
import AlternativeStrip from "./AlternativeStrip.jsx";

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  vehicleType: "walk",
  distanceKm: 0,
  acHours: 0,
  heavyAppliance: "none",
  dietType: "none",
  takeoutMeals: 0,
  newGoodsPurchased: "none",
  recycledOrComposted: false,
  notes: ""
};

const vehicleOptions = [
  { label: "Walk", value: "walk" },
  { label: "Bike", value: "bicycle" },
  { label: "Transit", value: "bus" },
  { label: "EV", value: "ev" },
  { label: "Motorbike", value: "motorbike" },
  { label: "Car", value: "gasoline_car" }
];

const applianceOptions = [
  { label: "None", value: "none" },
  { label: "Laundry Dryer", value: "laundry" },
  { label: "Water Heater / Geyser", value: "water_heater" },
  { label: "Both Heavy", value: "both" }
];

const dietOptions = [
  { label: "Not Logged", value: "none" },
  { label: "Vegan", value: "vegan" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Balanced / Mixed", value: "mixed" },
  { label: "Meat Heavy", value: "meat_heavy" }
];

const goodsOptions = [
  { label: "None", value: "none" },
  { label: "General Retail", value: "general" },
  { label: "Clothing / Fashion", value: "clothing" },
  { label: "Electronics", value: "electronics" }
];

const presets = [
  {
    label: "Low Footprint / Home",
    values: { vehicleType: "walk", distanceKm: 1, acHours: 2, heavyAppliance: "none", dietType: "vegetarian", takeoutMeals: 0, newGoodsPurchased: "none", recycledOrComposted: true }
  },
  {
    label: "Office & Commute",
    values: { vehicleType: "bus", distanceKm: 16, acHours: 6, heavyAppliance: "laundry", dietType: "mixed", takeoutMeals: 1, newGoodsPurchased: "none", recycledOrComposted: false }
  },
  {
    label: "High Impact Day",
    values: { vehicleType: "gasoline_car", distanceKm: 35, acHours: 10, heavyAppliance: "both", dietType: "meat_heavy", takeoutMeals: 2, newGoodsPurchased: "clothing", recycledOrComposted: false }
  }
];

const emissionFactors = {
  vehicle: {
    walk: 0,
    bicycle: 0,
    bus: 0.089,
    ev: 0.05,
    gasoline_car: 0.192,
    motorbike: 0.103
  },
  diet: {
    none: 0,
    vegan: 2.9,
    vegetarian: 3.8,
    mixed: 5.0,
    meat_heavy: 7.2
  },
  appliances: {
    none: 0,
    laundry: 1.2,
    water_heater: 1.8,
    both: 3.0
  },
  goods: {
    none: 0,
    general: 3.5,
    clothing: 10.0,
    electronics: 25.0
  }
};

const formStagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05
    }
  }
};

const formItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

function round(value) {
  return Number(value.toFixed(1));
}

function PillChoice({ label, value, options, onChange }) {
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {options.map((option) => {
          const active = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl px-3 py-3 text-xs font-semibold sm:text-sm transition ${
                active
                  ? "bg-[#15171b] text-white shadow-[0_12px_26px_rgba(20,22,26,0.16)] dark:bg-emerald-600 dark:text-white"
                  : "bg-white text-black/64 hover:bg-black/[0.04] dark:bg-[#252c37] dark:text-white/70 dark:hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Stepper({ label, value, unit, step = 1, min = 0, onChange }) {
  function update(nextValue) {
    onChange(Math.max(min, round(nextValue)));
  }

  return (
    <div className="rounded-[24px] bg-white dark:bg-[#222832] p-4 border border-black/5 dark:border-white/10">
      <p className="field-label">{label}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => update(Number(value) - step)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef1ed] dark:bg-[#181d24] text-black dark:text-white transition hover:bg-black hover:text-white dark:hover:bg-emerald-600"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={16} />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-3xl font-medium leading-none text-black dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-black/45 dark:text-white/45">{unit}</p>
        </div>
        <button
          type="button"
          onClick={() => update(Number(value) + step)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef1ed] dark:bg-[#181d24] text-black dark:text-white transition hover:bg-black hover:text-white dark:hover:bg-emerald-600"
          aria-label={`Increase ${label}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

export default function DataEntryForm({ userId, onLogged, onSubmitted, onCancelEdit, editingEntry = null, prefill = null }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const isEditing = Boolean(editingEntry);

  useEffect(() => {
    if (!editingEntry) {
      if (prefill) {
        setForm({
          ...initialForm,
          vehicleType: prefill.vehicleType ?? "walk",
          distanceKm: Number(prefill.distanceKm ?? 0)
        });
        setMessage("");
        return;
      }
      setForm(initialForm);
      setMessage("");
      return;
    }

    const transport = editingEntry.transportation ?? {};
    const energy = editingEntry.energy ?? {};
    const lifestyle = editingEntry.lifestyle ?? {};

    setForm({
      date: editingEntry.date ?? initialForm.date,
      vehicleType: transport.vehicleType ?? "walk",
      distanceKm: Number(transport.distanceKm ?? 0),
      acHours: Number(energy.acHours ?? 0),
      heavyAppliance: energy.heavyAppliance ?? "none",
      dietType: lifestyle.dietType ?? "none",
      takeoutMeals: Number(lifestyle.takeoutMeals ?? 0),
      newGoodsPurchased: lifestyle.newGoodsPurchased ?? "none",
      recycledOrComposted: Boolean(lifestyle.recycledOrComposted),
      notes: editingEntry.notes ?? ""
    });
    setMessage("");
  }, [editingEntry, prefill]);

  const estimate = useMemo(() => {
    const transport = Number(form.distanceKm) * (emissionFactors.vehicle[form.vehicleType] ?? 0);
    const ac = Number(form.acHours) * 0.75;
    const appliance = emissionFactors.appliances[form.heavyAppliance] ?? 0;
    const diet = emissionFactors.diet[form.dietType] ?? 0;
    const takeout = Number(form.takeoutMeals) * 0.85;
    const goods = emissionFactors.goods[form.newGoodsPurchased] ?? 0;
    const recyclingDiscount = form.recycledOrComposted ? -0.5 : 0;

    const total = transport + ac + appliance + diet + takeout + goods + recyclingDiscount;
    return round(Math.max(0, total));
  }, [form]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function applyPreset(values) {
    setForm((current) => ({ ...current, ...values }));
  }

  function updateField(event) {
    const { name, value } = event.target;
    setField(name, value);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    const payload = {
      userId,
      date: form.date,
      transportation: {
        vehicleType: form.vehicleType,
        distanceKm: Number(form.distanceKm)
      },
      energy: {
        acHours: Number(form.acHours),
        heavyAppliance: form.heavyAppliance
      },
      lifestyle: {
        dietType: form.dietType,
        takeoutMeals: Number(form.takeoutMeals),
        newGoodsPurchased: form.newGoodsPurchased,
        recycledOrComposted: form.recycledOrComposted
      },
      notes: form.notes
    };

    try {
      if (isEditing && editingEntry?.id) {
        const result = await updateCarbonEntry(userId, editingEntry.id, payload);
        setMessage(`Updated entry — ${result.entry.totalEmissionsKg} kg CO2e.`);
      } else {
        const result = await logCarbonEntry(payload);
        const badgeCopy = result.earnedBadges?.length
          ? ` Unlocked: ${result.earnedBadges.map((badge) => badge.label).join(", ")}!`
          : "";
        setMessage(`Logged ${result.entry.totalEmissionsKg} kg CO2e.${badgeCopy}`);
      }
      setForm(initialForm);
      (onSubmitted ?? onLogged)?.();
    } catch {
      setMessage("Backend unavailable. Demo dashboard remains active.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="workspace-card">
      <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <p className="field-label">Daily Data Check-in</p>
          <h2 className="mt-2 text-2xl font-medium text-black dark:text-white">
            {isEditing ? "Edit logged activity" : "Log practical activity"}
          </h2>
          <p className="mt-1 text-sm text-black/45 dark:text-white/50">
            {isEditing
              ? `Updating entry for ${editingEntry.date}.`
              : "Record your travel, energy, meals, and eco habits."}
          </p>
          {isEditing ? (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#0f5132]/10 dark:bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-[#0f5132] dark:text-emerald-400">
              <Pencil size={12} />
              Editing {editingEntry.date} ({editingEntry.totalEmissionsKg ?? 0} kg CO2e)
            </span>
          ) : null}
        </div>
        <motion.div
          animate={{ opacity: [0.82, 1, 0.82] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="rounded-[24px] bg-[#0f5132] dark:bg-emerald-600 px-5 py-4 text-white shadow-md"
        >
          <p className="text-xs uppercase tracking-[0.14em] text-white/55">Estimate</p>
          <p className="mt-1 text-3xl font-medium leading-none">{estimate}</p>
          <p className="mt-1 text-xs text-white/65">kg CO2e</p>
        </motion.div>
      </div>

      <motion.div variants={formStagger} initial="hidden" animate="show" className="space-y-5">
        <motion.div variants={formItem}>
          <p className="field-label">Quick start presets</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.values)}
                className="rounded-2xl bg-white dark:bg-[#222832] dark:text-white dark:border dark:border-white/10 px-4 py-3 text-xs font-semibold text-black transition hover:-translate-y-0.5 hover:bg-[#0f5132] hover:text-white dark:hover:bg-emerald-600 sm:text-sm"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.label variants={formItem} className="block">
          <span className="field-label">Log Date</span>
          <input className="field-input mt-2" type="date" name="date" value={form.date} onChange={updateField} />
        </motion.label>

        {/* Transportation Section */}
        <motion.section variants={formItem} className="section-card space-y-4">
          <div className="flex items-center gap-2 text-[#0f5132] dark:text-emerald-400 font-semibold text-sm">
            <span>🚗 Travel & Mobility</span>
          </div>
          <PillChoice label="Vehicle Used" value={form.vehicleType} options={vehicleOptions} onChange={(value) => setField("vehicleType", value)} />
          <Stepper label="Distance Traveled" value={form.distanceKm} unit="km" step={1} onChange={(value) => setField("distanceKm", value)} />
          <AlternativeStrip
            vehicleType={form.vehicleType}
            distanceKm={form.distanceKm}
            onUseMode={(modeId, distance) =>
              setForm((current) => ({ ...current, vehicleType: modeId, distanceKm: distance }))
            }
          />
        </motion.section>

        {/* Energy & Appliances Section */}
        <motion.section variants={formItem} className="section-card space-y-4">
          <div className="flex items-center gap-2 text-[#0f5132] dark:text-emerald-400 font-semibold text-sm">
            <Zap size={16} />
            <span>Home Energy & AC</span>
          </div>
          <Stepper label="AC / Heater Running Time" value={form.acHours} unit="hours" step={1} onChange={(value) => setField("acHours", value)} />
          <PillChoice label="Heavy Appliances Used Today" value={form.heavyAppliance} options={applianceOptions} onChange={(value) => setField("heavyAppliance", value)} />
        </motion.section>

        {/* Food & Lifestyle Section */}
        <motion.section variants={formItem} className="section-card space-y-4">
          <div className="flex items-center gap-2 text-[#0f5132] dark:text-emerald-400 font-semibold text-sm">
            <span>🥗 Food & Consumption</span>
          </div>
          <PillChoice label="Diet Pattern Choice" value={form.dietType} options={dietOptions} onChange={(value) => setField("dietType", value)} />
          <Stepper label="Online Food Delivery / Takeout" value={form.takeoutMeals} unit="orders" step={1} onChange={(value) => setField("takeoutMeals", value)} />
          <PillChoice label="New Retail / Goods Purchased Today" value={form.newGoodsPurchased} options={goodsOptions} onChange={(value) => setField("newGoodsPurchased", value)} />
        </motion.section>

        {/* Eco Habit Discount Section */}
        <motion.section variants={formItem} className="section-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#0f5132] dark:text-emerald-400 font-semibold text-sm">
                <Recycle size={16} />
                <span>Eco Habit Discount</span>
              </div>
              <p className="mt-1 text-xs text-black/55 dark:text-white/50">Did you sort recycling or compost food waste today?</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-black/5 dark:bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setField("recycledOrComposted", true)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  form.recycledOrComposted
                    ? "bg-[#0f5132] dark:bg-emerald-600 text-white shadow-md"
                    : "bg-transparent text-black/60 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                Yes (-0.5 kg)
              </button>
              <button
                type="button"
                onClick={() => setField("recycledOrComposted", false)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  !form.recycledOrComposted
                    ? "bg-white dark:bg-[#252c37] text-black dark:text-white shadow-md"
                    : "bg-transparent text-black/60 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                No
              </button>
            </div>
          </div>
        </motion.section>

        <motion.label variants={formItem} className="block">
          <span className="field-label">Optional Note</span>
          <textarea
            className="field-input mt-2 min-h-20 resize-none"
            name="notes"
            maxLength="240"
            placeholder="E.g. Took metro instead of car today..."
            value={form.notes}
            onChange={updateField}
          />
        </motion.label>
      </motion.div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.98 }} className="executive-button" type="submit" disabled={submitting}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : isEditing ? <Pencil size={16} /> : <Plus size={16} />}
            {isEditing ? `Update ${estimate} kg` : `Log ${estimate} kg`}
          </motion.button>
          {isEditing ? (
            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setMessage("");
                onCancelEdit?.();
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#222832] px-4 py-3 text-sm font-semibold text-black/70 dark:text-white/80 transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X size={15} />
              Cancel Editing
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setMessage("");
              }}
              className="rounded-2xl border border-black/15 dark:border-white/15 bg-white dark:bg-[#222832] px-4 py-3 text-sm font-semibold text-black/70 dark:text-white/80 transition hover:bg-black/5 dark:hover:bg-white/10"
            >
              Clear Form
            </button>
          )}
        </div>
        <AnimatePresence>
          {message ? (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 text-sm font-semibold text-black dark:text-white"
            >
              <CheckCircle2 size={16} />
              {message}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>
    </form>
  );
}
