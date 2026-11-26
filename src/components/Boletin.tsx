import { REGLAS } from "@/lib/config";
import { fmtNota, riesgoAcademico } from "@/lib/notas";
import type { MateriaBoletin } from "@/lib/consultas";
import { Chip, TablaScroll } from "./ui";

export function celdaNota(n: number | null) {
  if (n === null) return "text-muted";
  return n < REGLAS.notaAprobacion - 1 ? "text-bad font-bold" : n < REGLAS.notaAprobacion ? "text-warn font-bold" : "";
}

export function Boletin({ materias }: { materias: MateriaBoletin[] }) {
  return (
    <div className="grid gap-3">
      <TablaScroll>
        <table className="tabla tabular card overflow-hidden">
          <thead>
            <tr>
              <th>Materia</th>
              <th className="!text-center">1° trim.</th>
              <th className="!text-center">2° trim.</th>
              <th className="!text-center">3° trim.</th>
              <th>Seguimiento</th>
            </tr>
          </thead>
          <tbody>
            {materias.map((m) => {
              const r = riesgoAcademico(m.promedios);
              return (
                <tr key={m.id}>
                  <td>
                    <details>
                      <summary className="cursor-pointer font-semibold">{m.nombre}</summary>
                      <p className="mt-1 text-xs text-muted">{m.profesor}</p>
                      <ul className="mt-2 grid gap-1 text-xs">
                        {m.criterios.map((c) => (
                          <li key={c.id} className="flex justify-between gap-3">
                            <span>{c.nombre} <span className="text-muted">(peso {c.peso})</span></span>
                            <span className="whitespace-nowrap">{c.notas.map((n, i) => <span key={i} className={`ml-2 inline-block w-7 text-right ${celdaNota(n)}`}>{fmtNota(n)}</span>)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </td>
                  {m.promedios.map((p, i) => (
                    <td key={i} className={`!text-center text-base ${celdaNota(p)}`}>{fmtNota(p)}</td>
                  ))}
                  <td>{r.nivel === "ok" ? <Chip tono="ok">Bien</Chip> : <Chip tono={r.nivel === "riesgo" ? "peligro" : "aviso"}>{r.motivo}</Chip>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TablaScroll>
      <p className="text-xs text-muted">Escala de 1 a 10. Se aprueba con {REGLAS.notaAprobacion}. El promedio pondera cada criterio según su peso. Tocá una materia para ver el detalle.</p>
    </div>
  );
}
