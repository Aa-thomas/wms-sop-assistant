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
  { selector: '.operator-dashboard-tabs .tab-btn:nth-child(1)', title: 'Daily Briefing', description: 'Your daily briefing with key metrics, alerts, and quick actions to start your shift.' },
  { selector: '.metrics-cards', title: 'Your Metrics', description: 'Quick snapshot of your health, progress, and recent errors. Click any card for details.' },
  { selector: '.quick-actions', title: 'Quick Actions', description: 'Jump directly to training, health details, or error review.' },
  { selector: '.operator-dashboard-tabs .tab-btn:nth-child(2)', title: 'My Health', description: 'Track your personal health metrics and wellness history over time.' },
  { selector: '.operator-dashboard-tabs .tab-btn:nth-child(3)', title: 'Modules', description: 'Access your SOP training modules and track your learning progress.' },
  { selector: '.operator-dashboard-tabs .tab-btn:nth-child(4)', title: 'Pick Errors', description: 'Review your recent pick errors and learn from mistakes to improve accuracy.' },
];

export const SUPERVISOR_TOOLTIPS = [
  { selector: '.dashboard-tabs .tab-btn:nth-child(1)', title: 'Daily Briefing', description: 'Daily team briefing with alerts, action items, and shift updates.' },
  { selector: '.dashboard-tabs .tab-btn:nth-child(2)', title: 'Team Health', description: 'Monitor team wellness trends and individual health metrics.' },
  { selector: '.dashboard-tabs .tab-btn:nth-child(3)', title: 'Team Onboarding', description: 'Track team training progress across all SOP modules.' },
  { selector: '.dashboard-tabs .tab-btn:nth-child(4)', title: 'Knowledge Gaps', description: 'Identify common knowledge gaps from questions and anonymous feedback.' },
  { selector: '.dashboard-tabs .tab-btn:nth-child(5)', title: 'Pick Errors', description: 'Review team-wide pick error trends and patterns.' },
  { selector: '.dashboard-tabs .tab-btn:nth-child(6)', title: 'Feedback', description: 'Read anonymous feedback submitted by operators.' },
  { selector: '.dashboard-tabs .tab-btn:nth-child(7)', title: 'Admin', description: 'Manage users, roles, and system settings.' },
];

export const ONBOARDING_TOOLTIPS = [
  { selector: '.module-grid', title: 'Choose a Module', description: 'Pick a module to start learning. Each has step-by-step lessons with quizzes.' },
];
