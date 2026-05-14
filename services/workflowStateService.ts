import type { StepStatus, WorkflowState, WorkflowStepState } from "../types";

const nowIso = () => new Date().toISOString();

export function createWorkflowStep(status: StepStatus = "not_started"): WorkflowStepState {
  return {
    status,
    updatedAt: nowIso()
  };
}

export function createEmptyWorkflow(): WorkflowState {
  return {
    beatAnalysis: createWorkflowStep(),
    characterLocation: createWorkflowStep(),
    storyboard: createWorkflowStep(),
    promptEngineering: createWorkflowStep(),
    qa: createWorkflowStep(),
    finalResult: createWorkflowStep()
  };
}

export function markStepGenerating(step: WorkflowStepState): WorkflowStepState {
  return {
    ...step,
    status: "generating",
    updatedAt: nowIso(),
    errorMessage: undefined
  };
}

export function markStepNeedsReview(step: WorkflowStepState): WorkflowStepState {
  return {
    ...step,
    status: "needs_review",
    updatedAt: nowIso(),
    errorMessage: undefined
  };
}

export function markStepApproved(step: WorkflowStepState): WorkflowStepState {
  const approvedAt = nowIso();
  return {
    ...step,
    status: "approved",
    updatedAt: approvedAt,
    approvedAt,
    errorMessage: undefined
  };
}

export function markStepStale(step: WorkflowStepState, reason?: string): WorkflowStepState {
  return {
    ...step,
    status: "stale",
    updatedAt: nowIso(),
    errorMessage: reason
  };
}

export function markStepError(step: WorkflowStepState, errorMessage: string): WorkflowStepState {
  return {
    ...step,
    status: "error",
    updatedAt: nowIso(),
    errorMessage
  };
}

export function markDownstreamStaleAfterBeatEdit(workflow: WorkflowState): WorkflowState {
  return {
    ...workflow,
    storyboard: markStepStale(workflow.storyboard, "Beat data changed; storyboard may be outdated."),
    promptEngineering: markStepStale(workflow.promptEngineering, "Beat data changed; prompts may be outdated."),
    qa: markStepStale(workflow.qa, "Beat data changed; QA may be outdated."),
    finalResult: markStepStale(workflow.finalResult, "Beat data changed; final result must be rebuilt.")
  };
}

export function markDownstreamStaleAfterSourceEdit(workflow: WorkflowState): WorkflowState {
  return {
    ...workflow,
    beatAnalysis: markStepStale(workflow.beatAnalysis, "Source text changed; beat analysis may be outdated."),
    characterLocation: markStepStale(workflow.characterLocation, "Source text changed; character/location library may be outdated."),
    storyboard: markStepStale(workflow.storyboard, "Source text changed; storyboard may be outdated."),
    promptEngineering: markStepStale(workflow.promptEngineering, "Source text changed; prompts may be outdated."),
    qa: markStepStale(workflow.qa, "Source text changed; QA may be outdated."),
    finalResult: markStepStale(workflow.finalResult, "Source text changed; final result must be rebuilt.")
  };
}

export function markDownstreamStaleAfterCharacterEdit(workflow: WorkflowState): WorkflowState {
  return {
    ...workflow,
    promptEngineering: markStepStale(workflow.promptEngineering, "Character data changed; prompts may be outdated."),
    qa: markStepStale(workflow.qa, "Character data changed; QA may be outdated."),
    finalResult: markStepStale(workflow.finalResult, "Character data changed; final result must be rebuilt.")
  };
}

export function markDownstreamStaleAfterLocationEdit(workflow: WorkflowState): WorkflowState {
  return {
    ...workflow,
    promptEngineering: markStepStale(workflow.promptEngineering, "Location data changed; prompts may be outdated."),
    qa: markStepStale(workflow.qa, "Location data changed; QA may be outdated."),
    finalResult: markStepStale(workflow.finalResult, "Location data changed; final result must be rebuilt.")
  };
}

export function markDownstreamStaleAfterStoryboardEdit(workflow: WorkflowState): WorkflowState {
  return {
    ...workflow,
    promptEngineering: markStepStale(workflow.promptEngineering, "Storyboard changed; prompts may be outdated."),
    qa: markStepStale(workflow.qa, "Storyboard changed; QA may be outdated."),
    finalResult: markStepStale(workflow.finalResult, "Storyboard changed; final result must be rebuilt.")
  };
}

export function markDownstreamStaleAfterPromptEdit(workflow: WorkflowState): WorkflowState {
  return {
    ...workflow,
    qa: markStepStale(workflow.qa, "Prompt changed; QA may be outdated."),
    finalResult: markStepStale(workflow.finalResult, "Prompt changed; final result must be rebuilt.")
  };
}

export function markFinalResultStale(workflow: WorkflowState, reason = "Upstream data changed; final result must be rebuilt."): WorkflowState {
  return {
    ...workflow,
    finalResult: markStepStale(workflow.finalResult, reason)
  };
}
