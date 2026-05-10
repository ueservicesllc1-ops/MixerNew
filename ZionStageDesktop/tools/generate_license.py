import base64
import json
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives import serialization

def generate_keys():
    """Genera un par de claves RSA para el sistema de licencias."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    
    # Guardar clave privada
    with open("private_key.pem", "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
        
    # Guardar clave pública
    public_key = private_key.public_key()
    with open("public_key.pem", "wb") as f:
        f.write(public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ))
    print("Claves generadas: private_key.pem y public_key.pem")

def generate_serial(hid, plan="PRO", expires="2099-12-31"):
    """Genera un serial firmado para un Hardware ID específico."""
    with open("private_key.pem", "rb") as key_file:
        private_key = serialization.load_pem_private_key(
            key_file.read(),
            password=None,
        )

    data = {
        "hid": hid,
        "plan": plan,
        "expires": expires
    }
    
    json_data = json.dumps(data).encode('utf-8')
    
    # Firmar los datos
    signature = private_key.sign(
        json_data,
        padding.PSS(
            mgf=padding.MGF1(hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH
        ),
        hashes.SHA256()
    )
    
    # El serial final es [DATA_B64].[SIGNATURE_B64]
    serial_parts = [
        base64.b64encode(json_data).decode('utf-8'),
        base64.b64encode(signature).decode('utf-8')
    ]
    
    return ".".join(serial_parts)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Uso: python generate_license.py [GEN_KEYS | HID]")
        sys.exit(1)
        
    cmd = sys.argv[1]
    if cmd == "GEN_KEYS":
        generate_keys()
    else:
        # Ejemplo: python generate_license.py MY-HW-ID-123
        serial = generate_serial(cmd)
        print(f"\nSERIAL PARA HID {cmd}:")
        print("-" * 40)
        print(serial)
        print("-" * 40)
