import { watch, type WatchHandle } from "vue";
import type {
  AsyncFn,
  Optional,
  TaskOptions,
  TaskResult,
  TaskReturn,
} from "./types";
import {
  abortTask,
  createDebounce,
  createExecution,
  createTaskState,
  keyRegistry,
} from "./utils";

/**
 *
 * An Async Resource Wrapper That Gives
 * Common Application States
 * Out Of The Box With Full Reactivity
 *
 * @param {TaskOptions<TFn>} options
 * @returns {TaskReturn<TFn>}
 */
export function task<TFn extends AsyncFn>(
  options: TaskOptions<TFn>,
): TaskReturn<TFn> {
  if (options.key) {
    if (keyRegistry.has(options.key)) {
      throw new Error(`[IOCRAFT::TASK] duplicate key '${String(options.key)}'`);
    }
    keyRegistry.add(options.key);
  }

  const state = createTaskState<TFn>();
  const { execute } = createExecution(options, state);
  const debounce = createDebounce();

  let trackRef: Optional<WatchHandle>;

  if (options.track) {
    const { deps, immediate } = options.track;
    trackRef = watch(deps, (newArgs) => execute(...newArgs), { immediate });
  }

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    isLoading: state.isLoading,
    isIdle: state.isIdle,
    isError: state.isError,
    isSuccess: state.isSuccess,
    trackRef,
    run(...args: Parameters<TFn>): Promise<TaskResult<TFn>> {
      return options.debounce
        ? debounce(() => execute(...args), options.debounce)
        : execute(...args);
    },

    start(...args: Parameters<TFn>): Promise<TaskResult<TFn>> {
      if (state.initialized.value)
        return Promise.resolve([state.data.value, state.error.value]);
      state.initialized.value = true;
      return execute(...args);
    },

    stop(): void {
      if (!options.key) {
        console.warn("[IOCRAFT::TASK] ⟶ stop() requires a key and abortable()");
        return;
      }
      abortTask(options.key);
      state.executionId.value++;
      state.status.value = "idle";
      state.error.value = undefined;
    },

    reset(): void {
      state.executionId.value++;
      abortTask(options.key);
      state.status.value = "idle";
      state.data.value = undefined;
      state.error.value = undefined;
      state.initialized.value = false;
    },
  };
}
