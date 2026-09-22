import { randomBytes } from "node:crypto";

export const createNonce = (): string => randomBytes(24).toString("base64url");
