import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cqrcbjbmoxepfmxrjdnk.supabase.co';
const SUPABASE_KEY = 'sb_publishable__QqPxCGkHC4rk5QIRoZYCA_yhJXfqHe';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
