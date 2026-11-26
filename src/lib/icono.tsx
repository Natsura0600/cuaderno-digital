import { ImageResponse } from "next/og";

/** Ícono de la app (PNG) con el isotipo del colegio sobre blanco, con margen para íconos "maskable". */
export function iconoPng(s: number) {
  const k = (s * 0.62) / 270;
  const off = (s - 270 * k) / 2;
  const r = (x: number, y: number, w: number, h: number, c: string) => (
    <div style={{ position: "absolute", left: off + x * k, top: off + y * k, width: w * k, height: h * k, background: c }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, background: "#ffffff", display: "flex", position: "relative" }}>
        {r(0, 0, 140, 138, "#e5322c")}
        {r(145, 0, 125, 138, "#47a94a")}
        {r(227, 138, 43, 83, "#47a94a")}
        {r(0, 143, 140, 127, "#47a94a")}
        {r(140, 225, 83, 45, "#47a94a")}
        {r(145, 143, 78, 78, "#4a66a0")}
        {r(227, 226, 43, 44, "#e6e331")}
      </div>
    ),
    { width: s, height: s },
  );
}
