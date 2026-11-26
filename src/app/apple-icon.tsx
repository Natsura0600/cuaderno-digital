import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: 180, height: 180, background: "#1d5a44", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 46, height: 46, borderRadius: 23, background: "#f0b54a" }} />
        ))}
      </div>
    ),
    size,
  );
}
