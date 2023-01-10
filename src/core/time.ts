import dayjs, { ManipulateType } from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export { dayjs };

/**
 * Returns a correctly formatted TUF expiry timestamp given a ttl in the format of `[n, 'time']`, e.g. `[1, 'day']`
 */
export const getTUFExpiry = (ttl: (string | number)[]) => dayjs().add(ttl[0] as number, ttl[1] as ManipulateType).format('YYYY-MM-DDTHH:mm:ss[Z]');