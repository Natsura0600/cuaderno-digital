# Cuaderno Digital

Sistema de organización escolar para el **Colegio Montessori de Luján, Sede Acceso Oeste**. Es una app web que se instala en el celular (PWA) con cuentas para **familias, docentes, preceptores y directivos**.

- **Framework:** Next.js 16 (App Router), React 19 y Tailwind CSS 4
- **Base de datos:** Upstash Redis
- **Hosting:** Vercel, con deploy automático en cada push a GitHub

## Qué incluye

| Área | Funciones |
|---|---|
| **Gestión académica** | Horarios generados automáticamente según la disponibilidad docente, las aulas especiales y la carga horaria, con detección de superposiciones y edición manual · Calificaciones por criterio con peso, promedio automático y aviso temprano a la familia cuando un alumno baja de 7 · Planificación semanal enlazada al programa, con porcentaje de avance curricular · Banco de recursos por año, materia y unidad |
| **Asistencia y convivencia** | Toma de asistencia de un toque y aviso automático a la familia ante una ausencia o una llegada tarde · Ingreso con credencial QR desde la cámara del celular o un lector · Bitácora con incidentes **y** reconocimientos, protocolos de actuación paso a paso y seguimiento de cada caso · Panel de alertas tempranas que cruza inasistencias, notas e incidentes |
| **Comunicación** | Comunicados oficiales con confirmación de lectura, firma digital y autorizaciones · Agenda del alumno con tareas, evaluaciones y materiales · Reserva de reuniones en horarios libres del docente |
| **Calendario** | Calendario único con filtro por curso · Tope de 2 evaluaciones por día y por curso · Salidas pedagógicas con autorizaciones, pagos, lista de asistentes y responsables |
| **Administración** | Matrícula online con formulario público, carga de documentos y consulta del estado · Reinscripción desde la app · Cuotas, becas, registro de pagos, reporte de morosidad y recordatorios automáticos · Inventario y reserva de espacios y equipos por módulo · Reemplazos con sugerencias de docentes libres · Alta de alumnos, familias, equipo, cursos y materias |

Las reglas institucionales (nota de aprobación, tope de inasistencias, valor de una llegada tarde, módulos horarios) están en `src/lib/config.ts`. Los protocolos de convivencia están en `src/lib/protocolos.ts`.

## Publicarlo en Vercel con Upstash

1. **Repositorio:** subí este código a GitHub.
2. **Proyecto en Vercel:** en vercel.com, elegí *Add New → Project* y luego el repositorio. Vercel detecta Next.js solo.
3. **Base de datos:** en el proyecto, entrá a *Storage → Create Database → Upstash for Redis* (o *Connect* si ya tenés una base en Upstash) y conectala al proyecto. Así se crean solas las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
   - Si creaste la base directamente en upstash.com, cargá a mano `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (en Settings → Environment Variables).
4. **Clave de sesiones:** agregá la variable `SESSION_SECRET` con un texto largo y aleatorio. Podés generarlo así:
   ```bash
   openssl rand -hex 32
   ```
5. **Opcional, para subir archivos** (recursos y documentación de matrícula): en *Storage*, creá un **Blob** privado y conectalo al proyecto.
6. Volvé a desplegar el proyecto y entrá a `https://tu-proyecto.vercel.app/instalar`. Desde ahí tenés dos opciones:
   - **Empezar con datos reales:** creás la cuenta de dirección y después cargás cursos, materias, docentes, alumnos y familias desde *Comunidad*.
   - **Probar con datos de ejemplo:** carga un colegio ficticio con cuentas de prueba para cada rol.

### Cuentas de prueba (solo con los datos de ejemplo)

La contraseña de todas es `montessori`.

| Rol | E-mail |
|---|---|
| Directivo | `direccion@cuaderno.demo` |
| Preceptor | `preceptoria@cuaderno.demo` |
| Profesor | `profesora@cuaderno.demo` |
| Familia (dos hijos) | `familia@cuaderno.demo` |

> Antes de usarlo con datos reales, vaciá la base desde la consola de Upstash (*Data Browser → Flush*) y entrá a `/instalar` para crear la cuenta de dirección.

## Desarrollo en tu computadora

Hace falta Node.js 22 o superior. Para la base podés usar una de Upstash (copiando sus variables a `.env.local`) o un Redis local.

Instalá las dependencias:

```bash
npm install
```

Copiá el archivo de ejemplo de variables y completalo:

```bash
cp .env.example .env.local
```

Cargá los datos de ejemplo. **Esto borra todo lo que haya en la base:**

```bash
npm run db:seed
```

Levantá la app:

```bash
npm run dev
```

## Cómo están guardados los datos

Todas las claves empiezan con `cd:`. Por eso la base se puede compartir con otros proyectos.

- **Tablas chicas** (usuarios, cursos, materias, comunicados, eventos, etc.): un hash `cd:t:<tabla>` con `id → JSON`.
- **Lo que más crece** se guarda en un hash por dueño, para no leer de más:
  - `cd:asis:<alumno>`: la asistencia, con un campo por fecha.
  - `cd:notas:<alumno>`: las notas, con un campo `<criterio>:<trimestre>`.
  - `cd:cuotas:<alumno>`: las cuotas.
  - `cd:avisos:<usuario>`: los avisos de cada usuario.
  - `cd:lect:<comunicado>` y `cd:aut:<salida>`: las lecturas, las firmas y las autorizaciones.
- **Índices:** `cd:email:<email>`, `cd:qr:<código>` y `cd:mat:<código de matrícula>`.

La lógica de acceso está en `src/db/`, y los permisos por rol en `src/lib/alcance.ts`.

## Próximos pasos sugeridos

- Enviar los avisos también por e-mail, WhatsApp Business o notificaciones push. Hoy los avisos quedan dentro de la app.
- Cobrar en línea con Mercado Pago. Hoy secretaría registra los pagos y la familia puede avisar que ya pagó.
- Exportar boletines y reportes en PDF o Excel.
