import type { ProjectProfile, RuntimeWritePlan } from "@azi-harness/core";

import {
  prepareRuntimeInitialization,
  type PreparedInitialization
} from "./init-runtime.js";
import {
  prepareRuntimeSynchronization,
  type PreparedSynchronization
} from "./sync-runtime.js";

export interface PreparedSetup {
  mode: "init" | "sync";
  root: string;
  profile: ProjectProfile;
  plan: RuntimeWritePlan;
  prepared: PreparedInitialization | PreparedSynchronization;
}

export async function prepareRuntimeSetup(root: string): Promise<PreparedSetup> {
  const sync = await prepareRuntimeSynchronization(root);
  if (sync.status === "ready" && sync.profile !== null && sync.plan !== null) {
    return {
      mode: "sync",
      root: sync.root,
      profile: sync.profile,
      plan: sync.plan,
      prepared: sync
    };
  }

  const init = await prepareRuntimeInitialization(root);
  if (init.status !== "ready" || init.profile === null || init.plan === null) {
    throw new Error("Setup could not prepare the runtime plan.");
  }

  return {
    mode: "init",
    root: init.root,
    profile: init.profile,
    plan: init.plan,
    prepared: init
  };
}
