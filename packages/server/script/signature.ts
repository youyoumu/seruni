import crypto from "node:crypto";

class Script {
  async run() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

    const privateKeyPem = privateKey.export({
      type: "pkcs8",
      format: "pem",
    });

    const publicKeyPem = publicKey.export({
      type: "spki",
      format: "pem",
    });

    console.log(privateKeyPem);
    console.log(publicKeyPem);
  }
}

const script = new Script();
void script.run();
