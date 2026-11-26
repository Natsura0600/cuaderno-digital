"use client";

import { useActionState } from "react";
import { solicitar } from "./acciones";

export function FormInscripcion({ documentos }: { documentos: { campo: string; nombre: string }[] }) {
  const [estado, accion, pendiente] = useActionState(solicitar, null);
  return (
    <form action={accion} className="grid gap-6">
      <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <fieldset className="card grid gap-3 p-5 sm:grid-cols-2">
        <legend className="px-1 font-display text-lg font-bold">Alumno o alumna</legend>
        <label className="campo"><span>Nombre</span><input id="i-nombre" name="alumnoNombre" required className="input" /></label>
        <label className="campo"><span>Apellido</span><input id="i-apellido" name="alumnoApellido" required className="input" /></label>
        <label className="campo"><span>DNI</span><input id="i-dni" name="alumnoDni" required inputMode="numeric" className="input" /></label>
        <label className="campo"><span>Fecha de nacimiento</span><input id="i-nac" name="alumnoFechaNac" type="date" className="input" /></label>
        <label className="campo"><span>Nivel</span><select id="i-nivel" name="nivel" className="input" defaultValue="secundaria"><option value="inicial">Inicial</option><option value="primaria">Primaria</option><option value="secundaria">Secundaria</option></select></label>
        <label className="campo"><span>Año / grado al que ingresa</span><select id="i-anio" name="anio" className="input">{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}°</option>)}</select></label>
        <label className="campo sm:col-span-2"><span>Escuela de procedencia</span><input id="i-esc" name="escuelaAnterior" className="input" /></label>
      </fieldset>
      <fieldset className="card grid gap-3 p-5 sm:grid-cols-2">
        <legend className="px-1 font-display text-lg font-bold">Adulto responsable</legend>
        <label className="campo sm:col-span-2"><span>Nombre y apellido</span><input id="i-tutor" name="tutorNombre" required className="input" autoComplete="name" /></label>
        <label className="campo"><span>E-mail</span><input id="i-email" name="tutorEmail" type="email" required className="input" autoComplete="email" /></label>
        <label className="campo"><span>Teléfono</span><input id="i-tel" name="tutorTelefono" required inputMode="tel" className="input" autoComplete="tel" /></label>
      </fieldset>
      <fieldset className="card grid gap-3 p-5">
        <legend className="px-1 font-display text-lg font-bold">Documentación</legend>
        <p className="text-sm text-muted">PDF o foto, hasta 8 MB cada uno. Si te falta alguno, podés enviarlo después a secretaría.</p>
        {documentos.map((d) => (
          <label key={d.campo} className="campo"><span>{d.nombre}</span><input id={`i-${d.campo}`} name={d.campo} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="input" /></label>
        ))}
      </fieldset>
      <label className="campo"><span>¿Algo que quieras contarnos? (opcional)</span><textarea id="i-com" name="comentarios" rows={3} className="input" /></label>
      {estado?.error && <p role="alert" className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{estado.error}</p>}
      <button className="btn-prim py-3 text-base" disabled={pendiente}>{pendiente ? "Enviando…" : "Enviar solicitud"}</button>
    </form>
  );
}
