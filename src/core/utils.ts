import canonicalize from 'canonicalize';


/**
 * Serialises a Js object to canonical JSON.
 * 
 * NOTE: A public key is passed to this which contains the `\n` characters. ``canonicalize`` calls ``JSON.stringify()``
 * which converts the `\n` within the public key to `\\n`, which we don't want. We therefore replace
 * all occurences of `\\n` with `\n` after it has been stringified. This could probably be done in a better way.
 */
export const toCanonical = (data: object): string => canonicalize(data)!.replace(/\\n/g, '\n');


/**
 * Returns a ``Date`` object ``days`` in the future.
 * 
 * ``days`` should be positive whole number. 
 */
export const daysFromNow = (days: number): Date => new Date(new Date().setDate(new Date().getDate() + days));


/**
 * Formats a date to be compliant with TUF, i.e. ``YYYY-MM-DDTHH:MM:SSZ``.
 */
export const formatDate = (date: Date): string => date.toISOString().split('.')[0] + 'Z';