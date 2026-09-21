# Mi PC de casa — 100% GitHub + Vercel (sin VPS)

## Cómo funciona

```
[PC oficina: navegador]  <---WebRTC (video + control)--->  [PC casa: agent.py]
        |                                                          |
        '-------- señalización (breve) vía Vercel KV --------------'
```

- **Vercel**: hospeda la página `/view` (lo que abres desde la oficina) y el
  endpoint `/api/signal` (funciones serverless que usan Vercel KV como buzón
  de mensajes para establecer la conexión WebRTC).
- **GitHub**: tu repo, deploy automático en cada push.
- **Tu PC de casa**: corre `agent.py` — tu propio script, no un instalador de
  terceros. Comparte pantalla y ejecuta el mouse/teclado que le llega.
- Una vez conectados, el video y el control viajan **directo** entre los dos
  extremos (peer-to-peer) — Vercel solo ayudó a presentarlos al inicio.

**No hay ningún servidor que tengas que mantener, parchear o pagar por hora.**

---

## ⚠️ Léelo antes de invertir tiempo

Este es un proyecto real, no una app de 15 minutos. Cosas que Guacamole (la
alternativa con VPS) ya resuelve y que aquí tendrás que pulir tú mismo:

- **Latencia/calidad**: WebRTC punto a punto suele ir bien, pero si la red
  de tu oficina tiene un firewall/proxy muy restrictivo, puede forzar el uso
  del TURN gratuito (más lento) o fallar del todo.
- **Mapeo de teclado**: `pyautogui.keyDown` con `event.key` de JavaScript
  cubre lo básico, pero atajos (Ctrl+Alt+Supr, combinaciones raras, teclado
  no-inglés) necesitan trabajo extra.
- **Sin portapapeles compartido, sin múltiples monitores, sin reconexión
  automática robusta** — todo esto está simplificado en este MVP.
- El intercambio de candidatos ICE aquí está simplificado (no trickle ICE
  completo del lado del agente) — funciona en la mayoría de redes domésticas
  normales, pero en redes muy restrictivas podrías necesitar reforzarlo.

Si en algún punto la fricción no vale la pena, el plan con VPS + Guacamole
que armamos antes sigue ahí, listo para usar mientras maduras esta versión.

---

## 1. Crear el proyecto Next.js

```bash
npx create-next-app@latest remote-pc-vercel --js --app --no-tailwind --no-eslint --src-dir=false
cd remote-pc-vercel
```
Copia dentro `app/view/page.jsx` y `app/api/signal/route.js` de este paquete
(reemplazando lo que genere `create-next-app` en esas rutas).

```bash
npm install @upstash/redis
```

## 2. Subir a GitHub

Este proyecto ya viene con `git init` y el primer commit hechos. Solo falta
crear el repo remoto y conectarlo:

```bash
gh repo create mi-pc-remoto --private --source=. --push
```
O, sin `gh` CLI: crea un repo vacío en github.com, luego:
```bash
git remote add origin https://github.com/tu-usuario/mi-pc-remoto.git
git branch -M main
git push -u origin main
```
Luego en vercel.com → "Add New Project" → importa ese repo → deploy.

## 3. Activar Redis (Vercel KV ya no existe, ahora es Marketplace)

En el dashboard del proyecto en Vercel → pestaña **Storage** → **Marketplace
Database Providers** → elige **Upstash** (o "Redis") → **Create**. Al
conectarlo a tu proyecto, Vercel agrega automáticamente las variables de
entorno `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` — no hay que
copiarlas a mano.

## 4. Configurar tu contraseña de sala

En Vercel → Settings → Environment Variables, agrega:
```
ROOM_PASSWORD = algo-largo-y-unico-que-solo-tu-sepas
```
Redeploy para que tome efecto.

## 5. Preparar el agente en tu PC de casa

```powershell
pip install -r agent/requirements.txt
```
Edita `agent/agent.py`: pon la URL real de tu deploy de Vercel, un código de
sala, y la misma `ROOM_PASSWORD` que configuraste arriba.

```powershell
python agent.py
```
Déjalo corriendo (opcionalmente, agrégalo al Programador de tareas de
Windows para que arranque solo al iniciar sesión — sin instalar nada, solo
ejecuta tu propio script).

## 6. Conectarte desde la oficina

Abre `https://tu-app.vercel.app/view`, pon el código de sala y la
contraseña, dale "Conectar". En unos segundos deberías ver tu pantalla y
poder mover el mouse/escribir sobre el video.

---

## Seguridad mínima indispensable

- `ROOM_PASSWORD` debe ser larga y única — es lo único que evita que
  cualquiera con el link se conecte a tu PC.
- Nunca subas `agent.py` a un repo público con la contraseña escrita adentro
  (usa variables de entorno en vez de hardcodearla si vas a compartir el código).
- Considera agregar autenticación real (NextAuth, Clerk) a `/view` más
  adelante en vez de solo una contraseña compartida.
