"use client";

import { useEffect, useRef, useState } from "react";
import { registrarQr } from "../acciones";

type Lectura = { ok: boolean; msg: string; nombre?: string; hora: string };
type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };

export function Escaner() {
  const video = useRef<HTMLVideoElement>(null);
  const [camara, setCamara] = useState<"apagada" | "activa" | "no-disponible">("apagada");
  const [lecturas, setLecturas] = useState<Lectura[]>([]);
  const [codigo, setCodigo] = useState("");
  const ultimo = useRef<{ c: string; t: number }>({ c: "", t: 0 });

  async function procesar(c: string) {
    const limpio = c.trim().toUpperCase();
    if (!limpio) return;
    if (ultimo.current.c === limpio && Date.now() - ultimo.current.t < 4000) return;
    ultimo.current = { c: limpio, t: Date.now() };
    const r = await registrarQr(limpio);
    const hora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    setLecturas((l) => [{ ...r, hora }, ...l].slice(0, 30));
  }

  useEffect(() => {
    if (camara !== "activa") return;
    let stream: MediaStream | null = null;
    let corriendo = true;
    (async () => {
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      try {
        if (!BD) throw new Error("sin detector");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        const det = new BD({ formats: ["qr_code"] });
        const loop = async () => {
          if (!corriendo || !video.current) return;
          try {
            const r = await det.detect(video.current);
            if (r[0]) await procesar(r[0].rawValue);
          } catch {}
          setTimeout(loop, 350);
        };
        loop();
      } catch {
        setCamara("no-disponible");
      }
    })();
    return () => {
      corriendo = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camara]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card p-4">
        {camara === "activa" ? (
          <video ref={video} className="aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />
        ) : (
          <div className="grid aspect-square w-full place-items-center rounded-xl bg-surface-2 p-6 text-center">
            <div>
              <p className="font-semibold">{camara === "no-disponible" ? "La cámara no está disponible en este navegador" : "Escaneá la credencial de cada alumno al entrar"}</p>
              <p className="mt-1 text-sm text-muted">
                {camara === "no-disponible" ? "Usá Chrome en Android, o un lector USB/Bluetooth con el campo de abajo." : "Funciona con la cámara del celular o con un lector de códigos."}
              </p>
              {camara === "apagada" && <button className="btn-prim mt-4" onClick={() => setCamara("activa")}>Activar cámara</button>}
            </div>
          </div>
        )}
        <form
          className="mt-4 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await procesar(codigo);
            setCodigo("");
          }}
        >
          <label className="sr-only" htmlFor="codigo">Código de la credencial</label>
          <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código (ej. CD-1A2B3C4D)" className="input" autoComplete="off" />
          <button className="btn-sec">Registrar</button>
        </form>
      </div>
      <div className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Ingresos registrados</h2>
        {lecturas.length === 0 ? (
          <p className="text-sm text-muted">Todavía no se escaneó ninguna credencial.</p>
        ) : (
          <ul className="grid gap-2">
            {lecturas.map((l, i) => (
              <li key={i} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${!l.ok ? "bg-bad-soft text-bad" : l.msg.startsWith("Llegada") ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}>
                <span className="font-semibold">{l.nombre ?? "—"}</span>
                <span>{l.msg} · {l.hora}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
