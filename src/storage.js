import { supabase } from "./supabase";

const PREFIX = "hiromi-";
let pushTimer = null;

function gatherLocal() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(PREFIX)) data[k] = localStorage.getItem(k);
  }
  return data;
}

function createSyncStorage(pin) {
  function debouncedPush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      try {
        await supabase.from("sync").upsert({
          code: pin,
          data: gatherLocal(),
          updated_at: new Date().toISOString(),
        });
      } catch (e) {}
    }, 800);
  }

  return {
    async get(key) {
      const v = localStorage.getItem(key);
      return v !== null ? { value: v } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      debouncedPush();
    },
    async delete(key) {
      localStorage.removeItem(key);
      debouncedPush();
    },
  };
}

export async function pullFromCloud(pin) {
  try {
    const { data } = await supabase
      .from("sync")
      .select("data, updated_at")
      .eq("code", pin)
      .single();
    if (data?.data) {
      Object.entries(data.data).forEach(([k, v]) => {
        localStorage.setItem(k, v);
      });
      return true;
    }
  } catch (e) {}
  return false;
}

export function initStorage(pin) {
  localStorage.setItem("hiromi-pin", pin);
  const storage = createSyncStorage(pin);
  window.storage = storage;
  return storage;
}

export function getSavedPin() {
  return localStorage.getItem("hiromi-pin");
}
