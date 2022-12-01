import canonicalize from 'canonicalize';


/**
 * Serialises a Js object to canonical JSON.
 */
export const toCanonical = (data: object): string => canonicalize(data)!;