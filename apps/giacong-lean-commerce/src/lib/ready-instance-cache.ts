/** Reuse initialized clients, never an in-flight initialization or request result. */
export function createReadyInstanceCache<T>() {
  const databases = new WeakMap<object, Map<string, { configuration: readonly unknown[]; value: T }>>();

  return (
    database: object,
    origin: string,
    configuration: readonly unknown[],
    create: () => T,
    ready: (value: T) => Promise<unknown>,
  ): T => {
    const entries = databases.get(database);
    const cached = entries?.get(origin);
    if (cached && cached.configuration.length === configuration.length &&
      cached.configuration.every((part, index) => Object.is(part, configuration[index]))) {
      return cached.value;
    }

    const value = create();
    const snapshot = [...configuration];
    // A Worker request must own its pending I/O. Publish only after all
    // initialization and schema validation have completed successfully.
    void ready(value).then(() => {
      const completed = databases.get(database) ?? new Map();
      completed.set(origin, { configuration: snapshot, value });
      databases.set(database, completed);
    }, () => { /* The caller still receives the original initialization error. */ });
    return value;
  };
}
