import "server-only";
import { put, get } from "@vercel/blob";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const LOCAL = path.join(process.cwd(), ".uploads");
const usaBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS = /^(application\/pdf|image\/(png|jpe?g|webp)|application\/vnd\.openxmlformats.*|application\/msword|application\/vnd\.ms-.*|text\/plain)$/;

/** Guarda un archivo privado y devuelve la ruta interna para servirlo con /archivos. */
export async function guardarArchivo(file: File, carpeta: "recursos" | "matricula"): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("El archivo supera los 8 MB.");
  if (!TIPOS.test(file.type)) throw new Error("Formato no admitido. Usá PDF, imagen, Word, PowerPoint o Excel.");
  const limpio = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
  const ruta = `${carpeta}/${crypto.randomUUID()}-${limpio}`;
  if (usaBlob()) {
    await put(ruta, file, { access: "private", contentType: file.type });
  } else {
    const destino = path.join(LOCAL, ruta);
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, Buffer.from(await file.arrayBuffer()));
  }
  return ruta;
}

export async function leerArchivo(ruta: string): Promise<{ body: ReadableStream | Buffer; tipo: string } | null> {
  if (ruta.includes("..")) return null;
  if (usaBlob()) {
    const r = await get(ruta, { access: "private" });
    if (!r || r.statusCode !== 200) return null;
    return { body: r.stream, tipo: r.blob.contentType };
  }
  try {
    const buf = await readFile(path.join(LOCAL, ruta));
    const ext = ruta.split(".").pop()?.toLowerCase();
    const tipo =
      ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : ext?.match(/jpe?g/) ? "image/jpeg" : "application/octet-stream";
    return { body: buf, tipo };
  } catch {
    return null;
  }
}
