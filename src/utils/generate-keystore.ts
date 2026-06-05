import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function generate() {
  console.log("Starting KeyStore generation script...");
  const publicDir = path.join(process.cwd(), "public");
  const keystorePath = path.join(publicDir, "gard_vipwifi.jks");

  // If already exists, delete it first to recreate
  if (fs.existsSync(keystorePath)) {
    try {
      fs.unlinkSync(keystorePath);
      console.log("Deleted old Keystore from /public");
    } catch (e) {
      console.error("Could not delete old keystore file:", e);
    }
  }

  // Temporary files for certificate and key
  const tempKey = "/tmp/key.pem";
  const tempCert = "/tmp/cert.pem";

  try {
    // 1. Generate RSA private key and self-signed certificate
    const genCertCmd = `openssl req -newkey rsa:2048 -nodes -keyout "${tempKey}" -x509 -days 10000 -out "${tempCert}" -subj "/CN=Gard VIPWIFI/O=VIPWIFI/C=EG"`;
    console.log("Generating private key and certificate...");
    execSync(genCertCmd);

    // 2. Wrap them into a PKCS12 keystore (.jks or .p12)
    const exportCmd = `openssl pkcs12 -export -in "${tempCert}" -inkey "${tempKey}" -out "${keystorePath}" -name gard_vipwifi_alias -passout pass:vipwifi123`;
    console.log("Exporting to PKCS12 Keystore standard...");
    execSync(exportCmd);

    console.log(`Success! Android Keystore generated at: ${keystorePath}`);

    // Clean up temp files
    if (fs.existsSync(tempKey)) fs.unlinkSync(tempKey);
    if (fs.existsSync(tempCert)) fs.unlinkSync(tempCert);

    // Copy to dist/ as well if it exists
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      fs.copyFileSync(keystorePath, path.join(distPath, "gard_vipwifi.jks"));
      console.log("Successfully copied gard_vipwifi.jks to /dist");
    }
  } catch (error: any) {
    console.error("Error generating keystore:", error.message);
    if (error.stderr) {
       console.error("stderr:", error.stderr.toString());
    }
    if (error.stdout) {
       console.error("stdout:", error.stdout.toString());
    }
  }
}

generate();
