import { useMemo, useState } from 'react';
import { Database, FilePenLine, PlusCircle, RefreshCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader';
import { useAuth } from '../../hooks/useAuth';
import { useQuestions } from '../../hooks/useQuestions';
import { createQuestion, deleteQuestion, updateQuestion } from '../../services/questionService';
import { CATEGORIES, DIFFICULTY } from '../../utils/constants';
import './AdminDashboard.css';

const INITIAL_FORM_STATE = {
  text: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  explanation: '',
  difficulty: DIFFICULTY.MEDIUM,
  category: CATEGORIES.QUANTITATIVE,
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { userData, isDemoMode } = useAuth();
  const { questions, stats, loading, error, filters, updateFilter, refresh, meta } = useQuestions({
    category: CATEGORIES.BOTH,
    difficulty: DIFFICULTY.ALL,
    limit: 100,
  });

  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editingId, setEditingId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const totalQuestions = stats?.total || questions.length;
  const quantitativeCount = stats?.byCategory?.[CATEGORIES.QUANTITATIVE] || 0;
  const verbalCount = stats?.byCategory?.[CATEGORIES.VERBAL] || 0;

  const visibleQuestions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return questions
      .filter((question) => {
        if (!normalizedSearch) return true;

        const searchableText = [
          question.text,
          question.explanation,
          ...(question.options || []),
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedSearch);
      })
      .slice(0, 50);
  }, [questions, searchTerm]);

  const isEditing = Boolean(editingId);

  const handleOptionChange = (index, value) => {
    setFormData((currentForm) => {
      const nextOptions = [...currentForm.options];
      nextOptions[index] = value;

      return {
        ...currentForm,
        options: nextOptions,
      };
    });
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setEditingId('');
  };

  const handleEditQuestion = (question) => {
    const nextOptions = Array.from({ length: 4 }, (_, index) => question.options?.[index] || '');

    setEditingId(question.id);
    setFormData({
      text: question.text || '',
      options: nextOptions,
      correctAnswer: Number(question.correctAnswer || 0),
      explanation: question.explanation || '',
      difficulty: question.difficulty || DIFFICULTY.MEDIUM,
      category: question.category || CATEGORIES.QUANTITATIVE,
    });
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitQuestion = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        ...formData,
        correctAnswer: Number(formData.correctAnswer),
      };

      if (isEditing) {
        await updateQuestion(editingId, payload);
        setFeedback({ type: 'success', text: t('admin.questionUpdatedMessage') });
      } else {
        await createQuestion(payload);
        setFeedback({ type: 'success', text: t('admin.questionAddedMessage') });
      }

      resetForm();
      refresh();
    } catch (submitError) {
      setFeedback({
        type: 'error',
        text: submitError.message || t('common.error'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm(t('admin.deleteConfirmMessage'))) {
      return;
    }

    setFeedback(null);

    try {
      await deleteQuestion(questionId);
      setFeedback({ type: 'success', text: t('admin.questionDeletedMessage') });

      if (editingId === questionId) {
        resetForm();
      }

      refresh();
    } catch (deleteError) {
      setFeedback({
        type: 'error',
        text: deleteError.message || t('common.error'),
      });
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <h1 className="page-title">{t('admin.title')}</h1>
          <p className="admin-subtitle">{t('admin.manageQuestionsHint')}</p>
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={refresh}>
          <RefreshCcw size={16} />
          {t('common.retry')}
        </button>
      </div>

      <div className="admin-banner">
        <ShieldCheck size={18} />
        <div>
          <strong>{userData?.displayName || 'Admin'}</strong>
          <div>{isDemoMode ? t('admin.demoStorageNote') : t('admin.firestoreStorageNote')}</div>
        </div>
      </div>

      {feedback && (
        <div className={`admin-feedback ${feedback.type}`}>
          <span>{feedback.text}</span>
        </div>
      )}

      {error && (
        <div className="admin-feedback error">
          <span>{error}</span>
        </div>
      )}

      <div className="grid-3 admin-stats">
        <div className="card">
          <span className="admin-stat-label">{t('admin.totalQuestions')}</span>
          <div className="admin-stat-value">{totalQuestions}</div>
          <p className="admin-stat-note">{t('admin.questionList')}</p>
        </div>

        <div className="card">
          <span className="admin-stat-label">{t('exam.categoryCoverage')}</span>
          <div className="admin-stat-value">2</div>
          <p className="admin-stat-note">
            {quantitativeCount} {t('exam.quantitative')} • {verbalCount} {t('exam.verbal')}
          </p>
        </div>

        <div className="card">
          <span className="admin-stat-label">{t('admin.storageSource')}</span>
          <div className="admin-stat-value">{meta.source === 'demo' ? 'Local' : 'Cloud'}</div>
          <p className="admin-stat-note">
            {meta.source === 'demo' ? t('admin.demoStorageNote') : t('admin.firestoreStorageNote')}
          </p>
        </div>
      </div>

      <div className="grid-2 admin-layout">
        <section className="card">
          <div className="admin-section-title">
            {isEditing ? <FilePenLine size={18} /> : <PlusCircle size={18} />}
            <h2>{isEditing ? t('admin.editQuestion') : t('admin.addQuestion')}</h2>
          </div>

          <form className="admin-form" onSubmit={handleSubmitQuestion}>
            <div className="form-group">
              <label className="form-label">{t('admin.questionText')}</label>
              <textarea
                className="form-textarea"
                value={formData.text}
                onChange={(event) => setFormData((currentForm) => ({ ...currentForm, text: event.target.value }))}
                placeholder={t('admin.questionText')}
                required
              />
            </div>

            <div className="admin-options-grid">
              {formData.options.map((option, index) => (
                <div className="form-group" key={`option-${index}`}>
                  <label className="form-label">
                    {t('admin.option')} {index + 1}
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={option}
                    onChange={(event) => handleOptionChange(index, event.target.value)}
                    placeholder={`${t('admin.option')} ${index + 1}`}
                    required
                  />
                </div>
              ))}
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">{t('admin.correctAnswer')}</label>
                <select
                  className="form-select"
                  value={formData.correctAnswer}
                  onChange={(event) => setFormData((currentForm) => ({ ...currentForm, correctAnswer: event.target.value }))}
                >
                  {formData.options.map((option, index) => (
                    <option key={`correct-${index}`} value={index}>
                      {t('admin.option')} {index + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('exam.difficulty')}</label>
                <select
                  className="form-select"
                  value={formData.difficulty}
                  onChange={(event) => setFormData((currentForm) => ({ ...currentForm, difficulty: event.target.value }))}
                >
                  <option value={DIFFICULTY.EASY}>{t('exam.easy')}</option>
                  <option value={DIFFICULTY.MEDIUM}>{t('exam.medium')}</option>
                  <option value={DIFFICULTY.HARD}>{t('exam.hard')}</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('exam.category')}</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(event) => setFormData((currentForm) => ({ ...currentForm, category: event.target.value }))}
              >
                <option value={CATEGORIES.QUANTITATIVE}>{t('exam.quantitative')}</option>
                <option value={CATEGORIES.VERBAL}>{t('exam.verbal')}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('admin.explanation')}</label>
              <textarea
                className="form-textarea"
                value={formData.explanation}
                onChange={(event) => setFormData((currentForm) => ({ ...currentForm, explanation: event.target.value }))}
                placeholder={t('admin.explanation')}
              />
            </div>

            <div className="admin-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {isEditing ? <FilePenLine size={16} /> : <PlusCircle size={16} />}
                {submitting ? t('common.loading') : isEditing ? t('admin.saveChanges') : t('admin.addQuestion')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                {isEditing ? t('admin.cancelEdit') : t('common.cancel')}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="admin-section-title">
            <Database size={18} />
            <h2>{t('admin.questionList')}</h2>
          </div>

          <div className="admin-filter-row">
            <div className="form-group">
              <label className="form-label">{t('exam.category')}</label>
              <select
                className="form-select"
                value={filters.category}
                onChange={(event) => updateFilter('category', event.target.value)}
              >
                <option value={CATEGORIES.BOTH}>{t('exam.both')}</option>
                <option value={CATEGORIES.QUANTITATIVE}>{t('exam.quantitative')}</option>
                <option value={CATEGORIES.VERBAL}>{t('exam.verbal')}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('exam.difficulty')}</label>
              <select
                className="form-select"
                value={filters.difficulty}
                onChange={(event) => updateFilter('difficulty', event.target.value)}
              >
                <option value={DIFFICULTY.ALL}>{t('exam.all')}</option>
                <option value={DIFFICULTY.EASY}>{t('exam.easy')}</option>
                <option value={DIFFICULTY.MEDIUM}>{t('exam.medium')}</option>
                <option value={DIFFICULTY.HARD}>{t('exam.hard')}</option>
              </select>
            </div>
          </div>

          <div className="admin-search-row">
            <Search size={16} />
            <input
              type="search"
              className="form-input"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('admin.searchQuestions')}
            />
          </div>

          <p className="admin-results-meta">
            {t('admin.showingQuestions', { visible: visibleQuestions.length, total: questions.length })}
          </p>

          {loading ? (
            <Loader />
          ) : visibleQuestions.length === 0 ? (
            <div className="admin-empty-state">{t('admin.noQuestions')}</div>
          ) : (
            <div className="admin-list">
              {visibleQuestions.map((question, index) => (
                <article key={question.id} className="admin-question-card">
                  <div className="admin-question-head">
                    <div>
                      <div className="admin-question-meta">
                        <span className="badge badge-primary">#{index + 1}</span>
                        <span className="badge badge-warning">{t(`exam.${question.difficulty}`)}</span>
                        <span className="badge badge-success">{t(`exam.${question.category}`)}</span>
                      </div>
                      <h3 className="admin-question-title">{question.text}</h3>
                    </div>

                    <div className="admin-question-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEditQuestion(question)}
                      >
                        <FilePenLine size={14} />
                        {t('admin.edit')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteQuestion(question.id)}
                      >
                        <Trash2 size={14} />
                        {t('admin.delete')}
                      </button>
                    </div>
                  </div>

                  <p className="admin-question-note">
                    {question.options.map((option, optionIndex) => (
                      <span key={`${question.id}-${optionIndex}`}>
                        {optionIndex > 0 ? ' • ' : ''}
                        {option}
                      </span>
                    ))}
                  </p>

                  <p className="admin-answer">
                    {t('admin.correctAnswer')}: {question.options[question.correctAnswer] || '-'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
