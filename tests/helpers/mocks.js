/**
 * Shared mock factories for unit and integration tests.
 */

/** Create a fake SOP chunk */
function makeChunk(overrides = {}) {
  return {
    id: 'Test_SOP_slide_1',
    text: 'Step 1: Log in to the WMS portal.\nStep 2: Navigate to the main menu.',
    doc_title: 'Test SOP',
    source_locator: 'Test SOP - Slide 1',
    slide_number: 1,
    module: 'Navigation',
    similarity: 0.85,
    ...overrides,
  };
}

/** Create a fake onboarding step object (as returned by get_next_onboarding_step) */
function makeStep(overrides = {}) {
  return {
    step_number: 1,
    step_title: 'Logging In & Launching the WMS',
    step_description: 'Learn how to access the WMS portal and log in',
    search_queries: ['login', 'launch WMS'],
    checkpoint_question: 'What are the steps to log in and launch the WMS?',
    total_steps: 4,
    completed_count: 0,
    module: 'Navigation',
    ...overrides,
  };
}

/** Create a fake Claude onboarding explanation response */
function makeOnboardingResponse(overrides = {}) {
  return {
    explanation: 'To log in, navigate to the WMS portal URL and enter your credentials (Test SOP - Slide 1).',
    quick_tip: 'Bookmark the WMS portal URL for quick access.',
    common_mistake: 'Forgetting to select the correct warehouse after logging in.',
    citations: [
      {
        doc_title: 'Test SOP',
        source_locator: 'Slide 1',
        slide_number: 1,
        relevance: 'Covers the login procedure',
      },
    ],
    ...overrides,
  };
}

/** Create a fake Claude quiz validation response */
function makeQuizValidationResponse(overrides = {}) {
  return {
    is_correct: true,
    feedback: 'Great job! You correctly identified the login steps.',
    ...overrides,
  };
}

/** Fake progress row as returned from DB */
function makeProgressRow(overrides = {}) {
  return {
    user_id: 'test_user',
    module: 'Navigation',
    current_step: 1,
    completed_steps: null,
    started_at: new Date().toISOString(),
    last_activity: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

module.exports = {
  makeChunk,
  makeStep,
  makeOnboardingResponse,
  makeQuizValidationResponse,
  makeProgressRow,
};
