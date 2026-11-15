import crypto from "crypto";

export function generatePublicKey(): string {
  return "leo_" + crypto.randomBytes(8).toString("hex");
}

export function generateSecretTriggerKey(): string {
  return "trig_" + crypto.randomBytes(16).toString("hex");
}

export function generateId(): string {
  return crypto.randomUUID();
}
