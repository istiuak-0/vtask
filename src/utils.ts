import { computed, ref } from "vue";
import type { AsyncFn, ClearTimeOut, Optional, Primitives, RetryConfig, TaskOptions, TaskResult, TaskState, TaskStatus } from "./types";

export const AbortRegistry = new Map<Primitives, AbortController>();
export const keyRegistry = new Set<Primitives>();

export function createTaskState<TFn extends AsyncFn>(): TaskState<TFn> {
  const data = ref<Optional<Awaited<ReturnType<TFn>>>>();
  const error = ref<Optional<Error>>();
  const status = ref<TaskStatus>("idle");

  const initialized = ref(false);
  const executionId = ref(0);

  const isLoading = computed(() => status.value === "loading");
  const isIdle = computed(() => status.value === "idle");
  const isError = computed(() => status.value === "error");
  const isSuccess = computed(() => status.value === "success");

  return {
    data,
    error,
    status,
    initialized,
    isLoading,
    isIdle,
    isError,
    isSuccess,
    executionId,
  };
}

export function abortTask(key: Optional<Primitives>) {
  if (key) AbortRegistry.get(key)?.abort();
}

export function createTimeout(onTimeout: () => void, ms: number) {
  const handle = setTimeout(onTimeout, ms);
  return {
    clear: () => clearTimeout(handle),
  };
}

function getRetryDelay(config: RetryConfig, attempt: number): number | null {
  if (!config.delay) return null;
  return config.backoff
    ? config.delay * 2 ** (attempt - 1) // exponential: 100ms, 200ms, 400ms
    : config.delay; // flat: 100ms, 100ms, 100ms
}

export async function runTask<TFn extends AsyncFn>(fn: () => ReturnType<TFn>, config: Optional<RetryConfig>): Promise<TaskResult<TFn>> {
  /// No retry config Provided : Execute without retry
  if (!config) {
    try {
      const result = await fn();
      return [result, undefined];
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return [undefined, undefined];
      const error = e instanceof Error ? e : new Error(String(e));
      return [undefined, error];
    }
  }

  // Retry config present: execute with retry and delay/backoff
  const totalAttemptsAllowed = config.count + 1;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < totalAttemptsAllowed; attempt++) {
    if (attempt > 0) {
      const delay = getRetryDelay(config, attempt);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const result = await fn();
      return [result, undefined];
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return [undefined, undefined];
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  return [undefined, lastError];
}

export function createExecution<TFn extends AsyncFn>(options: TaskOptions<TFn>, state: TaskState<TFn>) {
  async function execute(...args: Parameters<TFn>): Promise<TaskResult<TFn>> {
    const currentExecutionId = ++state.executionId.value;
    abortTask(options.key);

    let timeout: Optional<ClearTimeOut>;

    /// Handle Timeout abort the request and update reactive states after timeout
    if (options.timeout) {
      timeout = createTimeout(() => {
        if (!options.key) {
          console.warn(
            "[IOCRAFT::TASK] ⟶ timeout triggered but request won't be cancelled — add a key and use abortable() to enable cancellation",
          );
        }
        abortTask(options.key);

        state.executionId.value++;
        state.status.value = "idle";
        state.error.value = undefined;
      }, options.timeout);
    }

    try {
      state.status.value = "loading";
      state.error.value = undefined;
      options.onLoading?.();

      const [result, error] = await runTask(() => options.fn(...args), options.retry);

      if (currentExecutionId !== state.executionId.value) return [undefined, undefined];

      if (error) {
        state.status.value = "error";
        state.error.value = error;
        options.onError?.(error);
        return [undefined, error];
      }

      state.status.value = "success";
      state.data.value = result as Awaited<ReturnType<TFn>>;
      options.onSuccess?.(result as Awaited<ReturnType<TFn>>);

      return [result as Awaited<ReturnType<TFn>>, undefined];
    } finally {
      timeout?.clear();
      if (currentExecutionId === state.executionId.value) {
        options.onFinally?.({ data: state.data.value, error: state.error.value });
      }
    }
  }

  return { execute };
}

export function createDebounce() {
  let handle: ReturnType<typeof setTimeout> | undefined;

  return function debounce<T>(fn: () => Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve) => {
      clearTimeout(handle);
      handle = setTimeout(() => resolve(fn()), ms);
    });
  };
}
