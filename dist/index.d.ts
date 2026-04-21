import { Ref, ComputedRef, WatchHandle } from 'vue';

type TaskStatus = "idle" | "loading" | "success" | "error";
type AsyncFn = (...args: unknown[]) => Promise<unknown>;
type TaskResult<TFn extends AsyncFn> = [Awaited<ReturnType<TFn>> | undefined, Error | undefined];
type Primitives = string | number | symbol;
type Optional<T> = T | undefined;

interface RetryConfig {
  count: number;
  delay?: number;
  backoff?: boolean;
}

interface ClearTimeOut {
  clear: () => void;
}

interface TaskOptions<TFn extends AsyncFn> {
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

interface TaskState<TFn extends AsyncFn> {
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

interface TaskReturn<TFn extends AsyncFn> extends Omit<TaskState<TFn>, "executionId" | "initialized"> {
  tracker?: TaskTracker;
  start: (...args: Parameters<TFn>) => Promise<TaskResult<TFn>>;
  run: (...args: Parameters<TFn>) => Promise<TaskResult<TFn>>;
  stop: () => void;
  reset: () => void;
  trackRef: Optional<WatchHandle>;
}

declare function abortable(key: Primitives): AbortController;

/**
 *
 * An Async Resource Wrapper That Gives
 * Common Application States
 * Out Of The Box With Full Reactivity
 *
 * @param {TaskOptions<TFn>} options
 * @returns {TaskReturn<TFn>}
 */
declare function task<TFn extends AsyncFn>(options: TaskOptions<TFn>): TaskReturn<TFn>;

declare const AbortRegistry: Map<Primitives, AbortController>;
declare const keyRegistry: Set<Primitives>;
declare function createTaskState<TFn extends AsyncFn>(): TaskState<TFn>;
declare function abortTask(key: Optional<Primitives>): void;
declare function createTimeout(onTimeout: () => void, ms: number): {
    clear: () => void;
};
declare function runTask<TFn extends AsyncFn>(fn: () => ReturnType<TFn>, config: Optional<RetryConfig>): Promise<TaskResult<TFn>>;
declare function createExecution<TFn extends AsyncFn>(options: TaskOptions<TFn>, state: TaskState<TFn>): {
    execute: (...args: Parameters<TFn>) => Promise<TaskResult<TFn>>;
};
declare function createDebounce(): <T>(fn: () => Promise<T>, ms: number) => Promise<T>;

export { AbortRegistry, type AsyncFn, type ClearTimeOut, type Optional, type Primitives, type RetryConfig, type TaskOptions, type TaskResult, type TaskReturn, type TaskState, type TaskStatus, abortTask, abortable, createDebounce, createExecution, createTaskState, createTimeout, keyRegistry, runTask, task };
