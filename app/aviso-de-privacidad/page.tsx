import Link from 'next/link';

export const metadata = {
  title: 'Aviso de Privacidad · LUMO',
};

// Versión vigente del aviso. Si cambias el texto, actualiza también
// CONSENTIMIENTO_VERSION en app/api/leads/route.ts para registrar
// qué versión aceptó cada persona.
const VERSION = '2026-07';

export default function AvisoDePrivacidad() {
  return (
    <div className="min-h-screen max-w-md mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold text-ink tracking-tight">Aviso de Privacidad</h1>
      <p className="text-sm text-ink-faint mt-1">Versión {VERSION}</p>

      <div className="lumo-card p-6 mt-6 space-y-4 text-sm text-ink-soft leading-relaxed">
        <p>
          <b className="text-ink">Responsable del tratamiento.</b> [Nombre completo del asesor o
          razón social], con domicilio en [domicilio], es responsable del tratamiento de tus
          datos personales conforme a la Ley Federal de Protección de Datos Personales en
          Posesión de los Particulares.
        </p>
        <p>
          <b className="text-ink">Datos que recabamos.</b> Nombre, número de teléfono (WhatsApp)
          y el tipo de seguro de tu interés, proporcionados voluntariamente a través de este
          sitio.
        </p>
        <p>
          <b className="text-ink">Finalidad.</b> Contactarte para brindarte orientación sobre
          productos de seguros y dar seguimiento a tu solicitud de información. No usamos tus
          datos para fines distintos sin tu consentimiento.
        </p>
        <p>
          <b className="text-ink">Transferencias.</b> Tus datos no se venden ni se comparten con
          terceros ajenos a la asesoría, salvo aseguradoras con las que solicites cotizar y
          obligaciones legales aplicables.
        </p>
        <p>
          <b className="text-ink">Derechos ARCO.</b> Puedes acceder, rectificar, cancelar u
          oponerte al tratamiento de tus datos escribiendo a [correo de contacto].
        </p>
        <p>
          <b className="text-ink">Conservación.</b> Conservamos tus datos únicamente el tiempo
          necesario para las finalidades descritas.
        </p>
        <p className="text-ink-faint text-xs">
          Nota para el asesor: sustituye los campos entre corchetes con tus datos reales antes
          de publicar. Este texto es una base y no constituye asesoría legal.
        </p>
      </div>

      <Link href="/solicitud" className="inline-block mt-6 text-azul font-semibold text-sm">
        ← Volver a la solicitud
      </Link>
    </div>
  );
}
