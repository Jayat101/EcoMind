import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Crown, Loader2, MapPin, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { INDIAN_CITIES } from "../constants/cities.js";

export default function EditProfileModal({ isOpen, user, titles = [], equippedTitle = null, onClose, onSave, onEquipTitle }) {
  const [name, setName] = useState(user?.name ?? "");
  const [city, setCity] = useState(user?.city ?? "New Delhi");
  const [picture, setPicture] = useState(user?.picture ?? "");
  const [pictureFailed, setPictureFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [equipped, setEquipped] = useState(equippedTitle);
  const [titleBusy, setTitleBusy] = useState(false);
  const [titleError, setTitleError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(user?.name ?? "");
      setCity(user?.city ?? "New Delhi");
      setPicture(user?.picture ?? "");
      setPictureFailed(false);
      setError("");
      setEquipped(equippedTitle ?? null);
      setTitleError("");
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen) setEquipped(equippedTitle ?? null);
  }, [isOpen, equippedTitle]);

  if (!isOpen) return null;

  async function handleEquip(title) {
    setTitleError("");
    if (titleBusy) return;
    setTitleBusy(true);
    try {
      await onEquipTitle?.(title);
      setEquipped(title ?? null);
    } catch (err) {
      setTitleError(err?.message ?? "Could not equip title.");
    } finally {
      setTitleBusy(false);
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image is too large. Please pick one under 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPicture(reader.result);
      setPictureFailed(false);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: cleanName, city, picture: picture.trim() || null });
    } catch (err) {
      setError(err?.message ?? "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          className="relative w-full max-w-md overflow-hidden rounded-[32px] bg-[#f7faf5] p-6 shadow-2xl sm:p-8 dark:bg-[#1c222c] dark:border dark:border-white/10"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#0f5132]">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl">
                <img src="/favicon.svg" alt="EcoMind" className="h-10 w-10" />
              </div>
              <span className="text-xl font-bold tracking-tight text-black dark:text-white">Edit Profile</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-black/60 transition hover:bg-black/10 hover:text-black dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/20 dark:hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative"
                aria-label="Change profile picture"
              >
                {picture && !pictureFailed ? (
                  <img
                    src={picture}
                    alt=""
                    onError={() => setPictureFailed(true)}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0f5132] text-2xl font-bold text-white uppercase">
                    {name?.[0] ?? "U"}
                  </div>
                )}
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#0f5132] text-white shadow-lg transition group-hover:bg-[#0b3d26]">
                  <Camera size={14} />
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <p className="text-[11px] text-black/50 dark:text-white/50">Tap the camera icon to upload a picture</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-4 text-sm font-medium text-black focus:border-[#0f5132] focus:outline-none dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">City</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40" />
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full appearance-none rounded-2xl border border-black/15 bg-white py-3 pl-10 pr-8 text-sm font-medium text-black focus:border-[#0f5132] focus:outline-none cursor-pointer dark:border-white/15 dark:bg-[#222832] dark:text-white dark:focus:border-emerald-500"
                >
                  {INDIAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#15171b] py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0f5132] active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : "Save Changes"}
            </button>

            {titles?.length > 0 ? (
              <div>
                <p className="block text-xs font-semibold text-black/70 mb-1 dark:text-white/70">Profile Title</p>
                <div className="flex flex-wrap gap-2">
                  {titles.map((title) => {
                    const isEquipped = equipped === title;
                    return (
                      <button
                        key={title}
                        type="button"
                        disabled={titleBusy}
                        onClick={() => handleEquip(isEquipped ? null : title)}
                        title={isEquipped ? "Unequip title" : `Equip ${title}`}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition active:scale-95 disabled:opacity-60 ${
                          isEquipped
                            ? "bg-amber-400 text-[#3a2500] shadow-md dark:bg-amber-400"
                            : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-white/15"
                        }`}
                      >
                        {isEquipped ? <Check size={13} /> : <Crown size={13} />}
                        {title}
                      </button>
                    );
                  })}
                </div>
                {titleError ? <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{titleError}</p> : null}
                <p className="mt-1.5 text-[11px] text-black/45 dark:text-white/45">
                  Earned by prestiging. Tap to show it on your profile.
                </p>
              </div>
            ) : null}
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
