// src/utils.ts
import { computed, ref } from "vue";
var AbortRegistry = /* @__PURE__ */ new Map();
var keyRegistry = /* @__PURE__ */ new Set();
function createTaskState() {
  const data = ref();
  const error = ref();
  const status = ref("idle");
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
    executionId
  };
}
function abortTask(key) {
  if (key) AbortRegistry.get(key)?.abort();
}
function createTimeout(onTimeout, ms) {
  const handle = setTimeout(onTimeout, ms);
  return {
    clear: () => clearTimeout(handle)
  };
}
function getRetryDelay(config, attempt) {
  if (!config.delay) return null;
  return config.backoff ? config.delay * 2 ** (attempt - 1) : config.delay;
}
async function runTask(fn, config) {
  if (!config) {
    try {
      const result = await fn();
      return [result, void 0];
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return [void 0, void 0];
      const error = e instanceof Error ? e : new Error(String(e));
      return [void 0, error];
    }
  }
  const totalAttemptsAllowed = config.count + 1;
  let lastError;
  for (let attempt = 0; attempt < totalAttemptsAllowed; attempt++) {
    if (attempt > 0) {
      const delay = getRetryDelay(config, attempt);
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      const result = await fn();
      return [result, void 0];
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return [void 0, void 0];
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  return [void 0, lastError];
}
function createExecution(options, state) {
  async function execute(...args) {
    const currentExecutionId = ++state.executionId.value;
    abortTask(options.key);
    let timeout;
    if (options.timeout) {
      timeout = createTimeout(() => {
        if (!options.key) {
          console.warn(
            "[IOCRAFT::TASK] \u27F6 timeout triggered but request won't be cancelled \u2014 add a key and use abortable() to enable cancellation"
          );
        }
        abortTask(options.key);
        state.executionId.value++;
        state.status.value = "idle";
        state.error.value = void 0;
      }, options.timeout);
    }
    try {
      state.status.value = "loading";
      state.error.value = void 0;
      options.onLoading?.();
      const [result, error] = await runTask(() => options.fn(...args), options.retry);
      if (currentExecutionId !== state.executionId.value) return [void 0, void 0];
      if (error) {
        state.status.value = "error";
        state.error.value = error;
        options.onError?.(error);
        return [void 0, error];
      }
      state.status.value = "success";
      state.data.value = result;
      options.onSuccess?.(result);
      return [result, void 0];
    } finally {
      timeout?.clear();
      if (currentExecutionId === state.executionId.value) {
        options.onFinally?.({ data: state.data.value, error: state.error.value });
      }
    }
  }
  return { execute };
}
function createDebounce() {
  let handle;
  return function debounce(fn, ms) {
    return new Promise((resolve) => {
      clearTimeout(handle);
      handle = setTimeout(() => resolve(fn()), ms);
    });
  };
}

// src/abort.ts
function abortable(key) {
  if (!keyRegistry.has(key)) {
    throw new Error(
      `[IOCRAFT::TASK] key '${String(key)}' is not registered \u2014 create a task with this key first`
    );
  }
  if (AbortRegistry.has(key)) return AbortRegistry.get(key);
  const controller = new AbortController();
  AbortRegistry.set(key, controller);
  return controller;
}

// src/task.ts
import { watch } from "vue";
function task(options) {
  if (options.key) {
    if (keyRegistry.has(options.key)) {
      throw new Error(`[IOCRAFT::TASK] duplicate key '${String(options.key)}'`);
    }
    keyRegistry.add(options.key);
  }
  const state = createTaskState();
  const { execute } = createExecution(options, state);
  const debounce = createDebounce();
  let trackRef;
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
    run(...args) {
      return options.debounce ? debounce(() => execute(...args), options.debounce) : execute(...args);
    },
    start(...args) {
      if (state.initialized.value)
        return Promise.resolve([state.data.value, state.error.value]);
      state.initialized.value = true;
      return execute(...args);
    },
    stop() {
      if (!options.key) {
        console.warn("[IOCRAFT::TASK] \u27F6 stop() requires a key and abortable()");
        return;
      }
      abortTask(options.key);
      state.executionId.value++;
      state.status.value = "idle";
      state.error.value = void 0;
    },
    reset() {
      state.executionId.value++;
      abortTask(options.key);
      state.status.value = "idle";
      state.data.value = void 0;
      state.error.value = void 0;
      state.initialized.value = false;
    }
  };
}
export {
  AbortRegistry,
  abortTask,
  abortable,
  createDebounce,
  createExecution,
  createTaskState,
  createTimeout,
  keyRegistry,
  runTask,
  task
};
