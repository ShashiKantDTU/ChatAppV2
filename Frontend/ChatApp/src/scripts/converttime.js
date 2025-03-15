function formatChatTime(timestamp) {
    // Ensure we have a valid Date object
    let date;
    try {
        // If timestamp is already a Date object
        if (timestamp instanceof Date) {
            date = timestamp;
        } 
        // If timestamp is a number (unix timestamp)
        else if (typeof timestamp === 'number') {
            date = new Date(timestamp);
        }
        // If timestamp is a string, try to parse it
        else if (typeof timestamp === 'string') {
            // Try ISO string parsing first
            date = new Date(timestamp);
            
            // If that fails, try unix timestamp parsing
            if (isNaN(date.getTime())) {
                const unixTimestamp = parseInt(timestamp);
                if (!isNaN(unixTimestamp)) {
                    date = new Date(unixTimestamp);
                }
            }
        }
        else {
            // Default to current time if we can't parse
            console.error('Invalid timestamp format:', timestamp);
            date = new Date();
        }
    }
    catch (error) {
        console.error('Error parsing date:', error);
        date = new Date();
    }
    
    const now = new Date();
    
    // Add debugging to understand the timestamp values
    console.log('formatChatTime debug:', {
        inputTimestamp: timestamp,
        inputType: typeof timestamp,
        parsedDate: date,
        nowTime: now,
        diffMs: now - date,
        diffInSeconds: Math.floor((now - date) / 1000),
        diffInMinutes: Math.floor((now - date) / (1000 * 60)),
        diffInHours: Math.floor((now - date) / (1000 * 60 * 60)),
        diffInDays: Math.floor((now - date) / (1000 * 60 * 60 * 24))
    });
    
    // Handle invalid date
    if (isNaN(date.getTime())) {
        console.error('Invalid date after parsing:', date);
        return "Unknown time";
    }
    
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    // Handle time in the future (clock skew)
    if (diffInSeconds < 0) {
        console.warn('Time in future detected, possible clock skew:', { 
            now: now.toISOString(), 
            date: date.toISOString(), 
            diffSeconds: diffInSeconds
        });
        return "Just now";
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    // More granular time differences
    if (diffInSeconds < 30) return "Just now";
    if (diffInSeconds < 60) return "Less than a minute ago";
    if (diffInMinutes === 1) return "1 minute ago";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInHours === 1) return "1 hour ago";
    if (diffInHours < 5) return `${diffInHours} hours ago`;
    if (diffInHours < 24) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return date.toLocaleDateString([], { weekday: "long" });
    if (now.getFullYear() === date.getFullYear()) return date.toLocaleDateString([], { month: "short", day: "numeric" });

    return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export default formatChatTime;