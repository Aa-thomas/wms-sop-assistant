// Tooltip definitions for each page during the onboarding tour

export const CHAT_TOOLTIPS = [
  { selector: '.search-bar input', title: 'Ask a Question', description: 'Type any question about warehouse procedures here.' },
  { selector: '.search-bar select', title: 'Filter by Module', description: 'Narrow results to a specific area like Inbound, Picking, or Returns.' },
  { selector: '.operator-trigger-btn', title: 'Operator Dashboard', description: 'View your daily briefing, health metrics, and pick error trends.' },
  { selector: '.onboarding-trigger-btn', title: 'Start Training', description: 'Begin structured SOP training with step-by-step modules and quizzes.' },
  { selector: '.starter-prompts', title: 'Quick Start', description: 'Click any card to try a sample question and see how answers work.' },
  { selector: '.feedback-fab', title: 'Send Feedback', description: 'Share anonymous feedback about the system anytime.' },
];

export const OPERATOR_TOOLTIPS = [
  { selector: '.operator-dashboard-tabs', title: 'Dashboard Tabs', description: 'Switch between your daily briefing, health metrics, training modules, and pick errors.' },
  { selector: '.metrics-cards', title: 'Your Metrics', description: 'Quick snapshot of your health, progress, and recent errors. Click any card for details.' },
  { selector: '.quick-actions', title: 'Quick Actions', description: 'Jump directly to training, health details, or error review.' },
];

export const SUPERVISOR_TOOLTIPS = [
  { selector: '.dashboard-tabs', title: 'Management Tabs', description: 'Access team briefings, health tracking, onboarding progress, knowledge gaps, and admin tools.' },
  { selector: '.summary-cards', title: 'Team Overview', description: 'Click any metric card to jump to its detailed view.' },
];

export const ONBOARDING_TOOLTIPS = [
  { selector: '.module-grid', title: 'Choose a Module', description: 'Pick a module to start learning. Each has step-by-step lessons with quizzes.' },
];
