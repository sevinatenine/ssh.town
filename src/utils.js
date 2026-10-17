function getDateTimeString() {
    return new Date().toLocaleString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Denver',
        timeZoneName: 'short',
    });
}

export { getDateTimeString };