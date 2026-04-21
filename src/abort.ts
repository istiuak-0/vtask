import type { Primitives } from "./types";
import { AbortRegistry, keyRegistry } from "./utils";

export function abortable(key: Primitives): AbortController {
  if (!keyRegistry.has(key)) {
    throw new Error(
      `[IOCRAFT::TASK] key '${String(key)}' is not registered — create a task with this key first`,
    );
  }

  if (AbortRegistry.has(key)) return AbortRegistry.get(key)!;

  const controller = new AbortController();
  AbortRegistry.set(key, controller);
  return controller;
}
