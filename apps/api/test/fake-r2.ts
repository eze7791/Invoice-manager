/** R2 en memoria para tests (solo get/put/delete). */
export function fakeR2() {
  const store = new Map<string, Uint8Array>();
  const bucket = {
    async get(key: string) {
      const bytes = store.get(key);
      return bytes ? { arrayBuffer: async () => bytes.slice().buffer } : null;
    },
    async put(key: string, value: Uint8Array | ArrayBuffer) {
      store.set(key, value instanceof Uint8Array ? value : new Uint8Array(value));
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
  return { bucket: bucket as unknown as R2Bucket, store };
}
