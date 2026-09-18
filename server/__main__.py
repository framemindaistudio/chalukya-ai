"""python -m server  → starts HTTP on :8300 and, if server/certs exist, HTTPS on :8443 (needed for mic/GPS on phones)."""
import asyncio
import socket
from pathlib import Path

import uvicorn

HERE = Path(__file__).parent
CERT, KEY = HERE / "certs" / "cert.pem", HERE / "certs" / "key.pem"


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]; s.close(); return ip
    except OSError:
        return "127.0.0.1"


async def main():
    servers = [uvicorn.Server(uvicorn.Config("server.main:app", host="0.0.0.0", port=8300, log_level="warning"))]
    if CERT.exists() and KEY.exists():
        servers.append(uvicorn.Server(uvicorn.Config("server.main:app", host="0.0.0.0", port=8443, ssl_certfile=str(CERT), ssl_keyfile=str(KEY), log_level="warning")))
    ip = lan_ip()
    print("\n  Chalukya AI is running")
    print(f"  Laptop:        http://localhost:8300          (command centre: /command)")
    print(f"  Phones (Wi-Fi): http://{ip}:8300")
    if len(servers) > 1: print(f"  Phones + mic:   https://{ip}:8443   (accept the certificate warning once)")
    print()
    await asyncio.gather(*(s.serve() for s in servers))


if __name__ == "__main__":
    asyncio.run(main())
