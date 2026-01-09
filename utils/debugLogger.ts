
// Simple global store for debug logs
export const debugLogs: string[] = [];

export const logError = (msg: string, details?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const cleanDetails = details ? JSON.stringify(details, null, 2) : '';
    const entry = `[${timestamp}] ${msg} ${cleanDetails}`;
    console.error(msg, details); // Keep console logging
    debugLogs.unshift(entry);
    if (debugLogs.length > 50) debugLogs.pop();
};
