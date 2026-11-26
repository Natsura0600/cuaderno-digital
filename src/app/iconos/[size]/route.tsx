import { ImageResponse } from "next/og";

export async function GET(_: Request, ctx: RouteContext<"/iconos/[size]">) {
  const { size } = await ctx.params;
  const s = size === "512" ? 512 : size === "180" ? 180 : 192;
  const r = s * 0.13;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, background: "#1d5a44", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: s * 0.035 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: r * 2, height: r * 2, borderRadius: r, background: "#f0b54a" }} />
        ))}
      </div>
    ),
    { width: s, height: s },
  );
}
