import canonicalize from 'canonicalize';


/**
 * Serialises a Js object to canonical JSON.
 * 
 * NOTE: A public key is passed to this which contains the `\n` characters. `canonicalize` calls `JSON.stringify()`
 * which converts the `\n` within the public key to `\\n`, which we don't want. We therefore replace
 * all occurences of `\\n` with `\n` after it has been stringified. This could probably be done in a better way.
 */
export const toCanonical = (data: object): string => canonicalize(data)!.replace(/\\n/g, '\n');