"use client";
import { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const { error: errorAuth } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (errorAuth) {
      setError('Correo o contraseña incorrectos');
    } else {
      // Si todo sale bien, lo mandamos a la página de inicio
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4">

      <div className="w-full max-w-md lumo-card p-8 relative">
        <span className="lumo-tape"></span>

        {/* Logotipo o Título */}
        <div className="text-center mb-8">
          {/* Aquí va tu logo */}
          <img src="/logo.png" alt="Logo CRM Seguros" className="w-24 h-24 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-bold text-ink tracking-tight">CRM Seguros</h1>
          <p className="font-hand text-xl text-ink-soft mt-1">tu asistente digital personal</p>
        </div>

        <form onSubmit={iniciarSesion} className="space-y-4">

          <div>
            <label className="block text-sm font-semibold text-ink-soft mb-1">Correo</label>
            <input
              type="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="lumo-input"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink-soft mb-1">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="lumo-input"
            />
          </div>

          {error && (
            <p className="text-rojo text-sm text-center font-medium bg-rojo-soft rounded-lg py-2">{error}</p>
          )}

          <button
            type="submit"
            className="w-full lumo-btn-primary py-3 mt-4"
          >
            Iniciar Sesión
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-ink-faint space-y-1">
          <a href="#" className="hover:text-azul">¿Olvidaste tu contraseña?</a>
          <p>·</p>
          <a href="#" className="hover:text-azul">Aviso de privacidad</a>
          <a href="#" className="hover:text-azul block">Soporte</a>
        </div>

      </div>

      <p className="font-hand text-lg text-ink-soft mt-6">hecho para pensar mejor, recordar más y vivir con <span className="text-rojo">intención</span>.</p>
    </div>
  );
}