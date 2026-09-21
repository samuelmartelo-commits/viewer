import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TTL_SECONDS = 300; // limpia mensajes viejos automáticamente

export async function POST(request) {
  const { room, role, type, data, password } = await request.json();

  if (!room || !role || !type) {
    return Response.json({ error: 'Faltan campos' }, { status: 400 });
  }
  if (password !== process.env.ROOM_PASSWORD) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  // El mensaje se guarda en la bandeja del rol CONTRARIO (a quien va dirigido)
  const targetRole = role === 'host' ? 'viewer' : 'host';
  const key = `signal:${room}:${targetRole}`;

  await redis.rpush(key, { type, data, ts: Date.now() });
  await redis.expire(key, TTL_SECONDS);

  return Response.json({ ok: true });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get('room');
  const role = searchParams.get('role');
  const password = searchParams.get('password');

  if (password !== process.env.ROOM_PASSWORD) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const key = `signal:${room}:${role}`;
  const messages = await redis.lrange(key, 0, -1); // ya vienen deserializados
  await redis.del(key); // ya entregados, se limpian

  return Response.json({ messages });
}
