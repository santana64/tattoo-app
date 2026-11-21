// Browser storage only. This module is never selected on iOS/Android:
// Metro resolves auth-storage.native.ts on native platforms.
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};
