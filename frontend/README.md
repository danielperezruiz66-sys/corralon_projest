# Frontend — Corralón Fer-Cons

React 19 + Vite 8 + JavaScript (sin TypeScript) + Tailwind 4.
La instalación completa y la configuración del backend están en
`../INSTRUCCIONES.md`.

```bash
npm install
npm run dev     # http://localhost:5173
npm run lint
npm run build
```

El proxy de Vite envía `/api` a `http://localhost:8000`; se puede cambiar con
`VITE_API_URL`.
