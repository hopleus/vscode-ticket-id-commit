let values: Record<string, unknown> = {};
export const getConfigurationCalls: { section: string | undefined; scope: unknown }[] = [];

export function setConfiguration(next: Record<string, unknown>): void {
  values = next;
  getConfigurationCalls.length = 0;
}

export const workspace = {
  getConfiguration(section?: string, scope?: unknown) {
    getConfigurationCalls.push({ section, scope });
    return {
      get(key: string): unknown {
        return values[key];
      },
    };
  },
};
