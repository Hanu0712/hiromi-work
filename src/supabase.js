import { createClient } from "@supabase/supabase-js";

const url = "https://vmmdwnysvkwufyvixxbs.supabase.co";
const key = "sb_publishable_GgsFQg22NYOgtVtgzKgsDw_RlT9B0b4";

export const supabase = createClient(url, key);
