# Portafolio — Juan Esteban Henao

Sitio de portafolio personal: una sola página, sin build ni framework (HTML + CSS + JavaScript puro).

- **Marca:** Juan Esteban Henao — Ingeniero de Software
- **Idiomas:** Español / Inglés (se cambia con el botón de idioma; recuerda la preferencia)
- **Diseño:** paleta oscura, héroe con retrato y marca de agua, animaciones de aparición y scroll suave (Lenis)

## Estructura

- `index.html` — todo el sitio (HTML, CSS y JS en un solo archivo)
- `CV.html` / `CV.pdf` / `CV-es.pdf` — currículum bilingüe (HTML + PDFs)
- `Imagenes/` — imágenes del héroe y capturas de las apps
- `vendor/lenis.mjs` — Lenis autocontenido (sin CDN externo)
- `api/contact.js` — endpoint propio del formulario de contacto (Vercel Serverless Function)
- `api/csp-report.js` — recolector de reportes de Content-Security-Policy
- `vercel.json` — cabeceras de seguridad y CSP

## Uso

Abre `index.html` directamente en el navegador, o sirve la carpeta con un servidor estático:

```bash
python -m http.server 8000
```

Luego visita `http://localhost:8000`.

> Nota: las funciones de `api/` solo se ejecutan en Vercel (`vercel dev` en local). Sin ellas, el formulario usa el respaldo automático (ver abajo).

## Formulario de contacto

El formulario intenta primero el endpoint propio `POST /api/contact`. Si el endpoint aún no está configurado (o no existe), cae automáticamente al relay FormSubmit para que el formulario **nunca se rompa**.

### Activar el endpoint propio (`api/contact.js`)

Configura estas variables en **Vercel → Project → Settings → Environment Variables** y vuelve a desplegar:

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `RESEND_API_KEY` | Sí (para enviar) | API key de [Resend](https://resend.com). Sin ella el endpoint responde `503` y se usa el respaldo. |
| `CONTACT_TO` | No | Bandeja destino. Por defecto `juaneshm3@gmail.com`. |
| `CONTACT_FROM` | No | Remitente verificado, p. ej. `Portfolio <contact@tudominio.com>`. Por defecto el remitente de pruebas de Resend. |
| `TURNSTILE_SECRET_KEY` | No (recomendada) | Secreto de Cloudflare Turnstile. Si se define, **exige** un token válido. |

Para activar el captcha, además pon la **site key pública** en `index.html`:

```html
<meta name="turnstile-site-key" content="TU_SITE_KEY" />
```

Configura site key y secret key **juntas** (o ninguna de las dos). Si defines solo el secret, el servidor rechazará envíos sin token.

## Seguridad

- Cabeceras en `vercel.json`: CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` y HSTS.
- El correo de contacto **no aparece en texto plano**: se guarda invertido en `<meta name="em">` y se reconstruye en tiempo de ejecución (los enlaces de correo se ocultan si el JavaScript está desactivado, mostrando un respaldo con entidades HTML).
- La CSP reporta violaciones a `POST /api/csp-report` (`report-uri` + `Reporting-Endpoints` / `report-to`); los reportes aparecen en Vercel → Project → Logs.
- Lenis se sirve localmente (`vendor/lenis.mjs`), sin dependencias de CDN de terceros.

## Enlaces

- LinkedIn: https://www.linkedin.com/in/juan-esteban-henao-manrique-15b558282/
- GitHub: https://github.com/Henao00
