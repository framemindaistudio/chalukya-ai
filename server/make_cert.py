"""Creates a self-signed certificate for the laptop's LAN IP so phones get HTTPS (mic, camera, GPS need it)."""
import datetime as dt
import ipaddress
import socket
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

out = Path(__file__).parent / "certs"; out.mkdir(exist_ok=True)
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try: s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]
except OSError: ip = "127.0.0.1"
finally: s.close()

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "chalukya-ai.local")])
san = x509.SubjectAlternativeName([x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1")), x509.IPAddress(ipaddress.ip_address(ip))])
now = dt.datetime.now(dt.timezone.utc)
cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - dt.timedelta(days=1)).not_valid_after(now + dt.timedelta(days=365)).add_extension(san, critical=False).sign(key, hashes.SHA256()))
(out / "key.pem").write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
(out / "cert.pem").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
print("certificate for", ip, "->", out)
