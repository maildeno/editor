export const generateId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
