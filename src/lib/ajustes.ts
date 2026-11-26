import "server-only";
import { kv } from "@/db/redis";
import { MODULOS, MODULOS_POR_DEFECTO, REGLAS, REGLAS_POR_DEFECTO, type Modulo, type Reglas } from "./config";

const CLAVE = "cd:config:ajustes";
const VIGENCIA_MS = 10_000;
let leido = 0;

type Guardado = { reglas?: Partial<Reglas>; modulos?: Modulo[] };

function aplicar(g: Guardado) {
  Object.assign(REGLAS, REGLAS_POR_DEFECTO, g.reglas ?? {});
  const mods = g.modulos?.length ? g.modulos : MODULOS_POR_DEFECTO;
  MODULOS.splice(0, MODULOS.length, ...mods.map((m, i) => ({ ...m, n: i + 1 })));
  REGLAS.modulosPorDia = MODULOS.length;
}

/** Carga la configuración del colegio (con un pequeño caché en memoria). */
export async function cargarAjustes() {
  if (Date.now() - leido < VIGENCIA_MS) return;
  try {
    const v = await kv.get(CLAVE);
    aplicar(v ? (JSON.parse(v) as Guardado) : {});
    leido = Date.now();
  } catch {
    // Sin base todavía: quedan los valores por defecto
  }
}

export async function leerAjustesGuardados(): Promise<Guardado> {
  const v = await kv.get(CLAVE);
  return v ? (JSON.parse(v) as Guardado) : {};
}

export async function guardarAjustes(g: Guardado) {
  const actual = await leerAjustesGuardados();
  const nuevo: Guardado = { reglas: { ...actual.reglas, ...g.reglas }, modulos: g.modulos ?? actual.modulos };
  await kv.set(CLAVE, JSON.stringify(nuevo));
  aplicar(nuevo);
  leido = Date.now();
}

/** Primer día del ciclo lectivo vigente (para no mezclar la asistencia de años anteriores). */
export const inicioCiclo = () => `${REGLAS.cicloLectivo}-01-01`;
