# Umbral · Web 3D

Sitio de una sola página con escena 3D en tiempo real (Three.js), scroll suave (Lenis) y animaciones (GSAP). El logo de Umbral, un arco, se convierte en un umbral monumental que la cámara atraviesa al hacer scroll.

## Estructura

```
umbral-3d/
├── index.html        Contenido, SEO (meta, Open Graph, JSON-LD) y carga de librerías
├── css/styles.css    Estilos, tokens de marca y responsive
├── js/scene.js       Escena 3D: arco, tres puertas, partículas, QR con láser, cámara por sección
├── js/ui.js          Scroll suave, navegación, hero, revelados, panel en vivo, WhatsApp
└── assets/           favicon.svg, logo.svg, og-umbral.png
```

## Ver en local

Abre `index.html` con doble clic: funciona directamente en Chrome, Edge, Firefox y Safari (necesita conexión a internet para cargar Three.js, GSAP, Lenis y las fuentes desde CDN).

Si prefieres un servidor local:

```
cd umbral-3d
python -m http.server 8080
```

y abre <http://localhost:8080>. También sirve la extensión Live Server de VS Code.

## Publicar

Es un sitio estático: sube la carpeta completa a cualquier hosting (Cloudflare Pages, Netlify, Vercel, GitHub Pages o el hosting actual de umbralcontrol.com).

## Personalizar

- **WhatsApp:** número y mensaje en `js/ui.js` (`WA_NUM`, `WA_MSG`).
- **Textos:** directamente en `index.html`.
- **Colores y tipografías:** variables al inicio de `css/styles.css`.
- **Cámara por sección:** objeto `CAMS` en `js/scene.js` (posición, punto de mira y deriva por scroll, con variante móvil).
- **Rendimiento:** en móvil se reducen partículas y resolución. Con `prefers-reduced-motion` se desactivan las animaciones.

## Librerías (CDN, versiones fijas)

- three 0.170.0 · gsap 3.12.5 · lenis 1.1.18
- Fuentes: Instrument Serif, Manrope, JetBrains Mono (Google Fonts)
