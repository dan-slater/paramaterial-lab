/**
 * Runtime configuration from the environment (read at call time, so a restart
 * with a new .env is all it takes). adapter-node itself reads ORIGIN, PORT,
 * HOST, BODY_SIZE_LIMIT, ADDRESS_HEADER and XFF_DEPTH; see web/.env.example.
 */
import { resolve } from 'node:path';

/** Directory holding the SQLite file. Default ./data relative to the working directory. */
export function dataDir(): string {
	return resolve(process.env.DATA_DIR || './data');
}

/** ALLOW_SIGNUP=false closes registration; existing accounts can still sign in. */
export function signupAllowed(): boolean {
	return (process.env.ALLOW_SIGNUP ?? 'true').trim().toLowerCase() !== 'false';
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 256; // argon2 cost is per byte; cap what we will hash
export const EMAIL_MAX = 254;
export const DISPLAY_NAME_MAX = 80;
