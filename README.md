# Facturación

App web privada para que un autónomo en España gestione clientes, emita facturas en PDF y exporte todo para su gestoría. Pensada para usarse desde el móvil (PWA) y alojada a coste cero en Cloudflare.

> Estado: **fase 4** (PDF, email y exportación). Ver [Hoja de ruta](#hoja-de-ruta).

## Stack

| Parte | Herramienta |
| --- | --- |
| Frontend | React + Vite + TypeScript, shadcn/ui, Tailwind CSS |
| API | Hono sobre Cloudflare Workers |
| Base de datos | PostgreSQL (Neon en producción vía Hyperdrive, Docker en local) |
| ORM | Drizzle ORM + drizzle-kit |
| Login | Better Auth (email y contraseña, sin registro público) |
| Archivos | Cloudflare R2 (logo, firma y PDFs) |
| PDF | pdf-lib |
| Email | Gmail por SMTP (worker-mailer) |
| Exportación | ZIP (fflate) con PDFs + CSV para Excel |
| Tests | Vitest |

Un único Worker sirve la web compilada y responde en `/api/*`.

```
apps/
  api/   Worker: Hono, Better Auth, Drizzle (src/db/schema.ts), migraciones en drizzle/
  web/   React + Vite + shadcn
```

## Desarrollo local

Requisitos: Node 20+, Docker.

```bash
npm install
cp .env.example .env
cp apps/api/.dev.vars.example apps/api/.dev.vars   # y pon un secreto: openssl rand -base64 32

npm run db:up          # Postgres en Docker
npm run db:migrate     # aplica las migraciones
npm run create-user -- tu@email.com "Tu Nombre" una-contraseña-larga

npm run dev            # API en :8787 y web en http://localhost:5173
```

Otros comandos:

```bash
npm test               # tests
npm run typecheck      # TypeScript en ambos paquetes
npm run db:generate    # nueva migración tras cambiar el esquema
```

## Despliegue (Cloudflare + Neon)

1. Crear una base de datos gratuita en [Neon](https://neon.tech) y copiar su cadena de conexión.
2. Aplicar migraciones contra Neon: `DATABASE_URL=<neon> npm run db:migrate`.
3. Crear el usuario: `DATABASE_URL=<neon> npm run create-user -- ...`.
4. En `apps/api`:
   ```bash
   npx wrangler hyperdrive create facturacion-db --connection-string="<neon>"
   # copiar el id devuelto en wrangler.jsonc → hyperdrive[0].id
   npx wrangler r2 bucket create facturacion-files
   npx wrangler secret put BETTER_AUTH_SECRET
   npx wrangler secret put BETTER_AUTH_URL     # p. ej. https://facturacion.<cuenta>.workers.dev
   # Opcional, para enviar facturas por email desde Gmail:
   npx wrangler secret put GMAIL_USER
   npx wrangler secret put GMAIL_APP_PASSWORD  # contraseña de aplicación de Google
   ```
5. `npm run deploy` desde la raíz.

## Decisiones de diseño

- **Contraseñas con PBKDF2 (Web Crypto)** en lugar del scrypt por defecto de Better Auth: scrypt en JavaScript supera el límite de CPU del plan gratuito de Workers.
- **Numeración sin huecos** por serie y año (`invoice_series`), con bloqueo `SELECT … FOR UPDATE` al emitir.
- **Facturas inmutables**: al emitir se guardan copias (`jsonb`) de los datos del emisor y del cliente; las correcciones se hacen con facturas rectificativas.
- **Exención de IVA** (actividad sanitaria, art. 20.Uno.3º Ley 37/1992) con retención de IRPF configurable.
- **PDF generado una sola vez** al emitir y guardado en R2 (la factura es inmutable); se regenera solo si cambia el estado de pago. La exportación empaqueta esos PDFs sin recomprimirlos para no gastar CPU del Worker.
- Ningún dato real (base de datos, PDFs, logos, secretos) va al repositorio.

## Hoja de ruta

1. ✅ Infraestructura, esquema de base de datos y login
2. ✅ Perfil del emisor y clientes
3. ✅ Facturas: conceptos, IRPF, emisión, rectificativas, pagos
4. ✅ PDF, envío por email y exportación para la gestoría
5. Dashboard, historial con filtros, PWA y despliegue
