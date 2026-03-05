declare module 'dexie' {
  export type WhereClause<T> = {
    equals(value: unknown): {
      toArray(): Promise<T[]>;
      first(): Promise<T | undefined>;
    };
  };

  export interface Table<T = any, TKey = any, TInsertType = T> {
    clear(): Promise<void>;
    bulkPut(items: TInsertType[]): Promise<TKey[] | void>;
    put(item: TInsertType): Promise<TKey>;
    toArray(): Promise<T[]>;
    count(): Promise<number>;
    where(index: string): WhereClause<T>;
  }

  export default class Dexie {
    constructor(name?: string);
    version(versionNumber: number): {
      stores(schema: Record<string, string>): Dexie;
    };
  }
}
