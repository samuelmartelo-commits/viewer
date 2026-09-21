'use client';

import { useEffect, useRef, useState } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
];

export default function ViewPage() {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const [room, setRoom] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Desconectado');
  const [connected, setConnected] = useState(false);

  async function sendSignal(type, data) {
    await fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, role: 'viewer', type, data, password }),
    });
  }

  async function pollSignal(pc) {
    while (pcRef.current === pc) {
      try {
        const res = await fetch(`/api/signal?room=${room}&role=viewer&password=${encodeURIComponent(password)}`);
        const { messages } = await res.json();
        for (const msg of messages) {
          if (msg.type === 'answer') await pc.setRemoteDescription(msg.data);
          else if (msg.type === 'candidate') await pc.addIceCandidate(msg.data);
        }
      } catch (e) { console.error(e); }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  async function connect() {
    setStatus('Conectando...');
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    pc.ontrack = (e) => { if (videoRef.current) videoRef.current.srcObject = e.streams[0]; };
    pc.onicecandidate = (e) => { if (e.candidate) sendSignal('candidate', e.candidate.toJSON()); };
    pc.onconnectionstatechange = () => {
      setStatus(pc.connectionState);
      setConnected(pc.connectionState === 'connected');
    };

    const dc = pc.createDataChannel('control');
    dcRef.current = dc;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal('offer', offer);

    pollSignal(pc);
  }

  function sendControl(msg) {
    if (dcRef.current?.readyState === 'open') dcRef.current.send(JSON.stringify(msg));
  }

  function handleMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    sendControl({ type: 'mousemove', x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  }

  useEffect(() => {
    function down(e) { if (connected) { e.preventDefault(); sendControl({ type: 'keydown', key: e.key }); } }
    function up(e) { if (connected) { e.preventDefault(); sendControl({ type: 'keyup', key: e.key }); } }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [connected]);

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif', color: '#eee', background: '#111', minHeight: '100vh' }}>
      <h1>Mi PC de casa</h1>
      {!connected && (
        <div style={{ marginBottom: 16 }}>
          <input placeholder="Código de sala" value={room} onChange={(e) => setRoom(e.target.value)} style={{ marginRight: 8 }} />
          <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginRight: 8 }} />
          <button onClick={connect}>Conectar</button>
        </div>
      )}
      <p>Estado: {status}</p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onMouseMove={handleMouseMove}
        onMouseDown={() => sendControl({ type: 'mousedown' })}
        onMouseUp={() => sendControl({ type: 'mouseup' })}
        style={{ width: '100%', maxWidth: 1280, border: '1px solid #333' }}
      />
    </div>
  );
}
