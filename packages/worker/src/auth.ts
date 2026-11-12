const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type AdminRole = "SUPER_ADMIN" | "MANAGER" | "STAFF";

export interface AdminIdentity {
  id: string;
  email: string;
  role: AdminRole;
  authVersion?: number;
}

const ITERATIONS = 310000;
const TOKEN_DURATION_SECONDS = 8 * 60 * 60;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    const base64 = value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  } catch {
    return null;
  }
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations,
      hash: "SHA-256"
    },
    key,
    256
  );

  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) {
    throw new Error("La contraseña debe tener entre 12 y 128 caracteres.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, ITERATIONS);

  return [
    "pbkdf2_sha256",
    String(ITERATIONS),
    encodeBase64Url(salt),
    encodeBase64Url(hash)
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    password.length > 128 ||
    typeof storedHash !== "string" ||
    storedHash.length > 500
  ) {
    return false;
  }

  const parts = storedHash.split("$");

  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") {
    return false;
  }

  const iterations = Number(parts[1]);

  if (
    !Number.isInteger(iterations) ||
    (iterations !== 100000 && iterations !== 310000)
  ) {
    return false;
  }

  const salt = decodeBase64Url(parts[2]);
  const expectedHash = decodeBase64Url(parts[3]);

  if (!salt || salt.length !== 16 || !expectedHash || expectedHash.length !== 32) {
    return false;
  }

  try {
    const actualHash = await derivePasswordHash(password, salt, iterations);

    let difference = 0;

    for (let i = 0; i < expectedHash.length; i++) {
      difference |= expectedHash[i] ^ actualHash[i];
    }

    return difference === 0;
  } catch {
    return false;
  }
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("La clave de autenticación no está configurada correctamente.");
  }

  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encoder.encode(secret)),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign", "verify"]
  );
}

export async function signAuthToken(
  identity: AdminIdentity,
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = encodeBase64Url(
    encoder.encode(JSON.stringify({
      alg: "HS256",
      typ: "JWT"
    }))
  );

  const payload = encodeBase64Url(
    encoder.encode(JSON.stringify({
      iss: "las-delicias-de-la-tia",
      sub: identity.id,
      email: identity.email,
      role: identity.role,
      av: Number.isInteger(identity.authVersion) && (identity.authVersion ?? 0) >= 0 ? identity.authVersion : 0,
      iat: now,
      exp: now + TOKEN_DURATION_SECONDS
    }))
  );

  const signingInput = `${header}.${payload}`;
  const key = await importSigningKey(secret);

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    toArrayBuffer(encoder.encode(signingInput))
  );

  return `${signingInput}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAuthToken(
  token: string,
  secret: string
): Promise<AdminIdentity | null> {
  if (typeof token !== "string" || token.length > 8192) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const headerBytes = decodeBase64Url(parts[0]);
  const payloadBytes = decodeBase64Url(parts[1]);
  const signature = decodeBase64Url(parts[2]);

  if (!headerBytes || !payloadBytes || !signature || signature.length !== 32) {
    return null;
  }

  try {
    const header = JSON.parse(decoder.decode(headerBytes)) as Record<string, unknown>;

    if (header.alg !== "HS256" || header.typ !== "JWT") {
      return null;
    }

    const key = await importSigningKey(secret);

    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(signature),
      toArrayBuffer(encoder.encode(`${parts[0]}.${parts[1]}`))
    );

    if (!validSignature) {
      return null;
    }

    const payload = JSON.parse(decoder.decode(payloadBytes)) as Record<string, unknown>;

    const validRole = (
      payload.role === "SUPER_ADMIN" ||
      payload.role === "MANAGER" ||
      payload.role === "STAFF"
    );

    const now = Math.floor(Date.now() / 1000);
    const authVersion = payload.av === undefined ? 0 : payload.av;

    if (
      !Number.isInteger(authVersion) ||
      (authVersion as number) < 0 ||
      payload.iss !== "las-delicias-de-la-tia" ||
      typeof payload.sub !== "string" ||
      payload.sub.length === 0 ||
      typeof payload.email !== "string" ||
      !validRole ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.iat > now + 60 ||
      payload.exp <= now ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > TOKEN_DURATION_SECONDS
    ) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as AdminRole,
      authVersion: authVersion as number
    };
  } catch {
    return null;
  }
}