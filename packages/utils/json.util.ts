export default {
  parse<T = unknown>(data: string, defaultValue: T): T {
    try {
      return JSON.parse(data) as T;
    } catch (e) {
      return defaultValue;
    }
  },
};
