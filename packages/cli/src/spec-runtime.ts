import {
  applyRuntimeWritePlan,
  createRuntimeWritePlan,
  type RuntimeWritePlan
} from "@azi-harness/core";
import {
  prepareSpecCreation,
  summarizeSpecValidation,
  validateSpecs,
  type PreparedSpecCreation,
  type SpecValidationReport
} from "@azi-harness/spec-kit";

export interface PreparedSpecWrite {
  root: string;
  spec: PreparedSpecCreation;
  plan: RuntimeWritePlan;
}

export async function prepareFeatureSpecCreation(
  root: string,
  featureName: string
): Promise<PreparedSpecWrite> {
  const spec = await prepareSpecCreation(root, featureName);
  const plan = await createRuntimeWritePlan(root, spec.intents);
  return { root, spec, plan };
}

export async function applyPreparedSpecCreation(prepared: PreparedSpecWrite): Promise<string[]> {
  return applyRuntimeWritePlan(prepared.plan);
}

export async function runSpecValidation(
  root: string,
  target?: string
): Promise<{
  reports: SpecValidationReport[];
  summary: ReturnType<typeof summarizeSpecValidation>;
}> {
  const reports = await validateSpecs(root, target);
  return {
    reports,
    summary: summarizeSpecValidation(reports)
  };
}

