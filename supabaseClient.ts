import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kbvbwuzhtsddqqacdfdb.supabase.co'
const supabaseAnonKey = 'sb_publishable_KczKDg4rZwj7t2fYzRX7jQ_rdFUsV-_'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)