/** Isotipo del Colegio Montessori (redibujado en vector a partir del logo original). */
export const COLORES_LOGO = { rojo: "#e5322c", verde: "#47a94a", azul: "#4a66a0", amarillo: "#e6e331" };

export function Isotipo({ size = 28, className }: { size?: number; className?: string }) {
  const { rojo, verde, azul, amarillo } = COLORES_LOGO;
  return (
    <svg width={size} height={size} viewBox="0 0 270 270" className={className} role="img" aria-label="Colegio Montessori">
      <rect x="0" y="0" width="140" height="138" fill={rojo} />
      <path d="M145 0H270V221H227V138H145Z" fill={verde} />
      <path d="M0 143H140V225H223V270H0Z" fill={verde} />
      <rect x="145" y="143" width="78" height="78" fill={azul} />
      <rect x="227" y="226" width="43" height="44" fill={amarillo} />
    </svg>
  );
}
