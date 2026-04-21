import type { ComputedRef, Ref, WatchHandle } from "vue";

export type TaskStatus = "idle" | "loading" | "success" | "error";
export type AsyncFn = (...args: unknown[]) => Promise<unknown>;
export type TaskResult<TFn extends AsyncFn> = [Awaited<ReturnType<TFn>> | undefined, Error | undefined];
export type Primitives = string | number | symbol;
export type Optional<T> = T | undefined;

export interface RetryConfig {
  count: number;
  delay?: number;
  backoff?: boolean;
}

export interface ClearTimeOut {
  clear: () => void;
}

export interface TaskOptions<TFn extends AsyncFn> {
  key?: Primitives;
  fn: TFn;
  debounce?: number;
  timeout?: number;
  retry?: RetryConfig;
  track?: {
    deps: () => Parameters<TFn>;
    immediate?: boolean;
  };
  onLoading?: () => void;
  onSuccess?: (data: Awaited<ReturnType<TFn>>) => void;
  onError?: (error: Error) => void;
  onFinally?: (result: { data?: Awaited<ReturnType<TFn>>; error?: Error }) => void;
}

export interface TaskState<TFn extends AsyncFn> {
  data: Ref<Awaited<ReturnType<TFn>> | undefined>;
  error: Ref<Error | undefined>;
  status: Ref<TaskStatus>;
  isLoading: ComputedRef<boolean>;
  isIdle: ComputedRef<boolean>;
  isSuccess: ComputedRef<boolean>;
  isError: ComputedRef<boolean>;
  initialized: Ref<boolean>;
  executionId: Ref<number>;
}

export interface TaskReturn<TFn extends AsyncFn> extends Omit<TaskState<TFn>, "executionId" | "initialized"> {
  tracker?: TaskTracker;
  start: (...args: Parameters<TFn>) => Promise<TaskResult<TFn>>;
  run: (...args: Parameters<TFn>) => Promise<TaskResult<TFn>>;
  stop: () => void;
  reset: () => void;
  trackRef: Optional<WatchHandle>;
}
