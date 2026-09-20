/**
 * Timezone utilities using native Intl.
 * Validates IANA timezones and computes organization calendar day boundaries.
 */

export const isValidTimezone = (timeZone: string): boolean => {
    if (!timeZone || typeof timeZone !== 'string') return false;
    try {
        new Intl.DateTimeFormat('en', { timeZone });
        return true;
    } catch {
        return false;
    }
};

/**
 * Formats a Date into YYYY-MM-DD in the given timezone.
 */
export const formatDateInTimezone = (date: Date, timeZone: string): string => {
    if (!isValidTimezone(timeZone)) {
        throw new Error(`Invalid timezone: ${timeZone}`);
    }
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    return formatter.format(date); // en-CA gives YYYY-MM-DD
};

/**
 * Returns the UTC Date boundaries (startOfDay, endOfDay) for a given calendar date
 * in the specified organization timezone.
 */
export const getOrganizationDayRange = (
    referenceDate: Date,
    timeZone: string
): { startOfDay: Date; endOfDay: Date } => {
    if (!isValidTimezone(timeZone)) {
        throw new Error(`Invalid timezone: ${timeZone}`);
    }

    const ymd = formatDateInTimezone(referenceDate, timeZone);
    const [year, month, day] = ymd.split('-').map(Number);

    // To find the UTC instant when 00:00:00 occurs in timeZone:
    // We construct an ISO timestamp and calculate timezone offset difference.
    const getUtcOffsetMinutes = (d: Date, tz: string): number => {
        const invDate = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
        const targetDate = new Date(d.toLocaleString('en-US', { timeZone: tz }));
        return (targetDate.getTime() - invDate.getTime()) / 60000;
    };

    // Approximate UTC midnight
    const approxStartUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const offsetStart = getUtcOffsetMinutes(approxStartUtc, timeZone);
    const exactStartOfDay = new Date(approxStartUtc.getTime() - offsetStart * 60000);

    // End of day is start of next day minus 1 millisecond
    const approxNextDayUtc = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
    const offsetEnd = getUtcOffsetMinutes(approxNextDayUtc, timeZone);
    const exactStartOfNextDay = new Date(approxNextDayUtc.getTime() - offsetEnd * 60000);
    const exactEndOfDay = new Date(exactStartOfNextDay.getTime() - 1);

    return {
        startOfDay: exactStartOfDay,
        endOfDay: exactEndOfDay,
    };
};
