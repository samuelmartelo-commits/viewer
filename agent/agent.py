"""
agent.py - Corre en tu PC de casa (Windows). Es TU código, no un instalador
de un tercero: comparte tu pantalla y ejecuta el mouse/teclado que llega
desde tu navegador en la oficina, vía WebRTC.

Requisitos (una sola vez):
    pip install aiortc requests pyautogui mss numpy av

Uso:
    python agent.py
"""

import asyncio
import fractions
import json

import numpy as np
import pyautogui
import requests
from aiortc import (
    RTCConfiguration,
    RTCIceServer,
    RTCPeerConnection,
    RTCSessionDescription,
)
from aiortc.contrib.media import MediaStreamTrack
from av import VideoFrame
import mss

# --- Configuración: ajusta estos 3 valores ---
SIGNAL_URL = "https://tu-app.vercel.app/api/signal"
ROOM = "cambia-este-codigo-de-sala"
PASSWORD = "cambia-esta-password-larga-y-unica"
# ----------------------------------------------

ICE_SERVERS = [
    RTCIceServer(urls="stun:stun.l.google.com:19302"),
    RTCIceServer(
        urls="turn:openrelay.metered.ca:80",
        username="openrelayproject",
        credential="openrelayproject",
    ),
]

pyautogui.FAILSAFE = False


class ScreenTrack(MediaStreamTrack):
    kind = "video"

    def __init__(self, fps=15):
        super().__init__()
        self.sct = mss.mss()
        self.monitor = self.sct.monitors[1]
        self.fps = fps
        self._timestamp = 0

    async def recv(self):
        await asyncio.sleep(1 / self.fps)
        img = np.array(self.sct.grab(self.monitor))[:, :, :3]
        frame = VideoFrame.from_ndarray(img, format="bgr24")
        self._timestamp += 1
        frame.pts = self._timestamp
        frame.time_base = fractions.Fraction(1, self.fps)
        return frame


def handle_control_message(raw, screen_w, screen_h):
    msg = json.loads(raw)
    t = msg.get("type")
    if t == "mousemove":
        pyautogui.moveTo(msg["x"] * screen_w, msg["y"] * screen_h, _pause=False)
    elif t == "mousedown":
        pyautogui.mouseDown(_pause=False)
    elif t == "mouseup":
        pyautogui.mouseUp(_pause=False)
    elif t == "keydown":
        try:
            pyautogui.keyDown(msg["key"], _pause=False)
        except Exception:
            pass
    elif t == "keyup":
        try:
            pyautogui.keyUp(msg["key"], _pause=False)
        except Exception:
            pass


def send_signal(session, type_, data):
    session.post(
        SIGNAL_URL,
        json={"room": ROOM, "role": "host", "type": type_, "data": data, "password": PASSWORD},
        timeout=10,
    )


async def poll_signal(session, pc):
    while True:
        try:
            res = session.get(
                SIGNAL_URL,
                params={"room": ROOM, "role": "host", "password": PASSWORD},
                timeout=10,
            )
            for msg in res.json().get("messages", []):
                if msg["type"] == "offer":
                    await pc.setRemoteDescription(RTCSessionDescription(**msg["data"]))
                    answer = await pc.createAnswer()
                    await pc.setLocalDescription(answer)
                    send_signal(
                        session,
                        "answer",
                        {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type},
                    )
        except Exception as e:
            print("Error de señalización:", e)
        await asyncio.sleep(1)


async def main():
    screen_w, screen_h = pyautogui.size()
    session = requests.Session()

    pc = RTCPeerConnection(RTCConfiguration(iceServers=ICE_SERVERS))
    pc.addTrack(ScreenTrack())

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            handle_control_message(message, screen_w, screen_h)

    print("Agente listo. Esperando conexión desde la oficina...")
    await poll_signal(session, pc)


if __name__ == "__main__":
    asyncio.run(main())
