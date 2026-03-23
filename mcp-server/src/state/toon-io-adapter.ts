/**
 * Official @toon-format/toon adapter for all internal state I/O.
 * Wraps @toon-format/toon encode/decode for all internal state I/O.
 */
import { encode, decode } from '@toon-format/toon';

/** Encode a value to TOON string with trailing newline. */
export function toonEncode<T>(value: T): string {
  return encode(value) + '\n';
}

/** Decode a TOON string to typed value. Throws on invalid input. */
export function toonDecode<T>(content: string): T {
  return decode(content) as T;
}

/** Safe decode with fallback. Returns null on failure. */
export function toonDecodeSafe<T>(content: string): T | null {
  try {
    return decode(content) as T;
  } catch {
    return null;
  }
}
