import { createClient } from '@supabase/supabase-js'

// Configuración desde variables de entorno (riesgo alto 4 de la
// auditoría: sin claves hardcodeadas en el código).
// - Local: definidas en .env.local (ver .env.example).
// - Producción: Vercel → Settings → Environment Variables.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Copia .env.example a .env.local y llena los valores (y configúralos en Vercel).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
