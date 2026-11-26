import { iconoPng } from "@/lib/icono";

export async function GET(_: Request, ctx: RouteContext<"/iconos/[size]">) {
  const { size } = await ctx.params;
  return iconoPng(size === "512" ? 512 : size === "180" ? 180 : 192);
}
