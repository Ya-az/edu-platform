import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_EXAM_SETTINGS } from '../utils/constants';
import { getQuestions, getQuestionStats } from '../services/questionService';

const DEFAULT_FILTERS = {
  category: DEFAULT_EXAM_SETTINGS.category,
  difficulty: DEFAULT_EXAM_SETTINGS.difficulty,
  limit: DEFAULT_EXAM_SETTINGS.questionCount,
};

export function useQuestions(initialFilters = {}) {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...initialFilters });
  const [questions, setQuestions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadQuestionBank = async () => {
      setLoading(true);
      setError('');

      try {
        const [questionList, questionStats] = await Promise.all([
          getQuestions({
            category: filters.category,
            difficulty: filters.difficulty,
            limit: Number(filters.limit),
          }),
          getQuestionStats(),
        ]);

        if (!isMounted) return;

        setQuestions(questionList);
        setStats(questionStats);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError.message || 'Failed to load question bank.');
        setQuestions([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadQuestionBank();

    return () => {
      isMounted = false;
    };
  }, [filters, refreshKey]);

  const updateFilter = useCallback((key, value) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((currentValue) => currentValue + 1);
  }, []);

  const meta = useMemo(
    () => ({
      totalAvailable: stats?.total || 0,
      filteredCount: questions.length,
      source: stats?.source || 'firestore',
      isEmpty: questions.length === 0,
    }),
    [questions.length, stats]
  );

  return {
    questions,
    stats,
    loading,
    error,
    filters,
    setFilters,
    updateFilter,
    refresh,
    meta,
  };
}

export default useQuestions;
