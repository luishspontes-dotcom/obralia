type DbError = { message: string };

export type DbResult<T = unknown> = {
  data: T | null;
  error: DbError | null;
  count?: number | null;
};

export type DbQuery<T = unknown> = PromiseLike<DbResult<T>> & {
  select(columns?: string, options?: Record<string, unknown>): DbQuery<T>;
  insert(values: unknown): DbQuery<T>;
  update(values: unknown): DbQuery<T>;
  delete(): DbQuery<T>;
  eq(column: string, value: unknown): DbQuery<T>;
  neq(column: string, value: unknown): DbQuery<T>;
  gte(column: string, value: unknown): DbQuery<T>;
  is(column: string, value: unknown): DbQuery<T>;
  in(column: string, values: unknown[]): DbQuery<T>;
  not(column: string, operator: string, value: unknown): DbQuery<T>;
  order(column: string, options?: Record<string, unknown>): DbQuery<T>;
  limit(count: number): DbQuery<T>;
  range(from: number, to: number): DbQuery<T>;
  single(): Promise<DbResult<T>>;
  maybeSingle(): Promise<DbResult<T>>;
};

export type UntypedSupabase = {
  from<T = unknown>(table: string): DbQuery<T>;
};

export function untypedDb(client: unknown): UntypedSupabase {
  return client as UntypedSupabase;
}
