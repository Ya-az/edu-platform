// Exam categories
export const CATEGORIES = {
  QUANTITATIVE: 'quantitative',
  VERBAL: 'verbal',
  BOTH: 'both',
};

// Difficulty levels
export const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  ALL: 'all',
};

// Exam modes
export const EXAM_MODES = {
  PRACTICE: 'practice',
  EXAM: 'timed',
  TIMED: 'timed',
};

// User roles
export const ROLES = {
  STUDENT: 'student',
  ADMIN: 'admin',
};

// Subscription types
export const SUBSCRIPTION = {
  FREE: 'free',
  PREMIUM: 'premium',
};

// Default exam settings
export const DEFAULT_EXAM_SETTINGS = {
  mode: EXAM_MODES.PRACTICE,
  category: CATEGORIES.BOTH,
  difficulty: DIFFICULTY.ALL,
  questionCount: 10,
  timerMinutes: 30,
};

export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20, 25, 30];

// Free tier limits
export const FREE_TIER_LIMITS = {
  examsPerDay: 3,
  questionsPerExam: 10,
};
