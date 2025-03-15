
function formatChatTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 60) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInHours < 24) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return date.toLocaleDateString([], { weekday: "long" });
    if (now.getFullYear() === date.getFullYear()) return date.toLocaleDateString([], { month: "short", day: "numeric" });

    return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  }

export default formatChatTime;