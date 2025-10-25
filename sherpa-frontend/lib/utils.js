export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function saveToLocal(key, data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save", e);
  }
}

export function readFromLocal(key, fallback = []) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Failed to read", e);
    return fallback;
  }
}

