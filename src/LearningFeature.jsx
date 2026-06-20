import React, { useState, useEffect, useCallback } from 'react';
import { generateSmartLearningPath, detectKnowledgeGaps } from './openaiService.js';
import { generateKnowledgeGateQuiz } from './engines.js';
import { formatClientName } from './data.js'; // Ensure correct imports

export default function LearningFeature({ activeAdvisor, clientsState, cpdModules, cpdRecentNotes, cpd, businessImpact }) {
  const [completedModules, setCompletedModules] = useState([]);
  const [completedCpdHours, setCompletedCpdHours] = useState(activeAdvisor.cpdHours || 0);
  const cpdTarget = activeAdvisor.cpdTarget || 40;
  
  const addAudit = (msg) => console.log('Audit:', msg);

  const [cpdRecommendation, setCpdRecommendation] = useState({});
  const [isGeneratingLearningPath, setIsGeneratingLearningPath] = useState(false);
  const [activeCoursePrototype, setActiveCoursePrototype] = useState(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizData, setQuizData] = useState(null);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [mockGaps, setMockGaps] = useState([]);
  const [isDetectingGaps, setIsDetectingGaps] = useState(false);

  useEffect(() => {
    setIsGeneratingLearningPath(true);
    generateSmartLearningPath(activeAdvisor, clientsState, cpdModules, cpdRecentNotes).then(rec => {
      setCpdRecommendation(rec);
      setIsGeneratingLearningPath(false);
    });
  }, [activeAdvisor, clientsState, cpdRecentNotes, cpdModules]);

  useEffect(() => {
    setIsDetectingGaps(true);
    detectKnowledgeGaps(clientsState, cpdModules).then(gaps => {
      setMockGaps(gaps);
      setIsDetectingGaps(false);
    });
  }, [clientsState, cpdModules]);

  const handleQuizSuccess = useCallback(() => {
    if (quizData && quizData.course) {
      const course = quizData.course;
      setCompletedCpdHours((prev) => Math.min(cpdTarget, +(prev + (course.cpdHours ?? 2.0)).toFixed(1)));
      setCompletedModules((prev) => {
        if (prev.some((m) => m.id === course.id)) return prev;
        return [...prev, { ...course, completedAt: new Date().toISOString() }];
      });
      addAudit(`Completed CPD module & passed Knowledge Gate: ${course.title}`, 'Low');
      if (cpdRecommendation.module && course.id === cpdRecommendation.module.id) {
        setLessonCompleted(true);
      }
    }
    setShowQuizModal(false);
    setQuizData(null);
  }, [quizData, addAudit, cpdTarget, cpdRecommendation, setCompletedCpdHours, setCompletedModules]);

  return (
    <>
      {showQuizModal && quizData && (
        <QuizModal quiz={quizData} onSuccess={handleQuizSuccess} onClose={() => setShowQuizModal(false)} />
      )}
      <div className="content-grid">
        <div className="panel advisor-readiness-panel">
          <div className="panel-header">
            <strong>🔍 Gaps Detected From Your Recent Notes</strong>
            <small>Last scanned: just now</small>
          </div>
          <ul className="gaps-list">
            {isDetectingGaps ? (
              <li style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                🔄 AI is analyzing your notes and detecting knowledge gaps...
              </li>
            ) : (
              <>
                {mockGaps.filter(gap => !completedModules.some(m => m.id === gap.courseId)).slice(0, 3).map(gap => (
                  <li key={gap.id}>• <span>{gap.label}</span></li>
                ))}
                {mockGaps.filter(gap => !completedModules.some((m) => m.id === gap.courseId)).length === 0 && (
                  <li className="gap-completed">✅ All detected gaps have been addressed!</li>
                )}
              </>
            )}
          </ul>
        </div>
      </div>

      {activeCoursePrototype ? (
        <InlineCoursePlayer 
          course={activeCoursePrototype} 
          onClose={() => setActiveCoursePrototype(null)} 
          onComplete={() => {
            const quiz = generateKnowledgeGateQuiz(activeCoursePrototype, activeAdvisor.id, clientsState);
            if (quiz) {
              setQuizData({ ...quiz, course: activeCoursePrototype });
              setShowQuizModal(true);
            } else {
              setCompletedModules((prev) => {
                if (prev.some((m) => m.id === activeCoursePrototype.id)) return prev;
                return [...prev, { ...activeCoursePrototype, completedAt: new Date().toISOString() }];
              });
              setCompletedCpdHours((prev) => Math.min(cpdTarget, +(prev + (activeCoursePrototype.cpdHours ?? 2.0)).toFixed(1)));
            }
            setActiveCoursePrototype(null);
          }} 
        />
      ) : (
        <div className="content-grid">
          <LearningPanel 
            cpd={cpd.filter(course => !cpdRecommendation.module || course.id !== cpdRecommendation.module.id)} 
            completedModules={completedModules} 
            onStartCourse={setActiveCoursePrototype} 
            cpdRecommendation={cpdRecommendation}
            isGeneratingLearningPath={isGeneratingLearningPath}
          />
          <div className="cpd-right-stack">
            <CpdProgressGauge completed={completedCpdHours} target={cpdTarget} />
            <section className="panel advisor-readiness-panel">
              <div className="panel-header">
                <h2>Advisor Readiness</h2>
                <span>Just-in-time learning</span>
              </div>
              <div className="readiness-split" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="readiness-col">
                  <strong>Learning Readiness</strong>
                  <p>• CPD Progress: {businessImpact.cpdReadiness}% on track</p>
                  <p>• Next milestone: Aug 31</p>
                  <p>• On track for compliance</p>
                </div>
                <div className="readiness-col">
                  <strong>Activity Tracker</strong>
                  {businessImpact.followUpCompletion > 0 ? (
                    <>
                      <p>• Follow-up completion: {businessImpact.followUpCompletion}%</p>
                      <p>• (32 of 43 follow-ups sent)</p>
                    </>
                  ) : (
                    <>
                      <p>• Follow-ups this week: --</p>
                      <p className="empty-state">📎 Connect your calendar to start tracking activity</p>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
      <div className="content-grid">
        <StudyHistoryPanel completedModules={completedModules} mockGaps={mockGaps} />
      </div>
    </>
  );
}

// Extracted Components Below

function InlineCoursePlayer({ course, onClose, onComplete }) {
  const isCompleted = course.completedAt != null;
  const [slide, setSlide] = useState(1);
  const totalSlides = 3;

  const nextSlide = () => {
    if (slide < totalSlides) setSlide(slide + 1);
  };

  return (
    <section className="panel inline-course-player" style={{ borderLeft: '4px solid var(--primary-color)' }}>
      <div className="panel-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px', marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h2 style={{ margin: '0 0 5px 0' }}>Interactive Course Module</h2>
            <span style={{ color: 'var(--text-secondary)' }}>{course.title}</span>
          </div>
          <button className="btn ghost" onClick={onClose} type="button" style={{ padding: '5px 10px' }}>Close</button>
        </div>
      </div>
      
      <div className="course-content-mock" style={{ minHeight: '180px', padding: '20px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        {slide === 1 && (
          <>
            <h4 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>1. Core Concepts & Overview</h4>
            <p style={{ marginBottom: '10px' }}>Welcome to <strong>{course.title}</strong>. This module focuses on exploring foundational principles tailored for your High Net Worth and Mass Affluent portfolios.</p>
            <p>Understanding these scenarios is critical for delivering compliant, effective, and highly personalized financial advice.</p>
          </>
        )}
        {slide === 2 && (
          <>
            <h4 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>2. Regulatory Updates & Suitability</h4>
            <p style={{ marginBottom: '10px' }}>Recent guidelines emphasize the need for rigorous, transparent documentation.</p>
            <p>You must consistently log your suitability rationale when discussing these strategies, ensuring alignment with both client goals and regulatory frameworks.</p>
          </>
        )}
        {slide === 3 && (
          <>
            <h4 style={{ color: 'var(--primary-color)', marginBottom: '10px' }}>3. Application & Next Steps</h4>
            <p style={{ marginBottom: '10px' }}>You have learned how to identify risks, structure appropriate solutions, and document your advice properly.</p>
            <p>Next, you must pass the <strong>Knowledge Gate</strong> assessment to verify your understanding and earn your {course.cpdHours ?? 2.0} CPD hours.</p>
          </>
        )}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Page {slide} of {totalSlides}</span>
        <div className="progress-bar-mini" style={{ width: '150px', flexGrow: 1, margin: '0 15px' }}>
          <div className="fill" style={{ width: `${(slide / totalSlides) * 100}%` }}></div>
        </div>
      </div>

      <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '30px' }}>
        {slide < totalSlides ? (
          <button className="btn secondary-action" onClick={nextSlide}>
            Continue Reading →
          </button>
        ) : (
          <button className="btn primary-action" onClick={onComplete} disabled={isCompleted}>
            {isCompleted ? "Already Completed" : "Finish Reading & Take Quiz"}
          </button>
        )}
      </div>
    </section>
  );
}


function LearningPanel({ cpd, completedModules, onStartCourse, cpdRecommendation, isGeneratingLearningPath }) {
  const recommendedMod = cpdRecommendation?.module;
  
  return (
    <section className="panel portfolio-courses-panel">
      <PanelHeader title="Smart Learning Path" meta="Portfolio-Matched Courses" />
      <div className="stack">
        {isGeneratingLearningPath ? (
          <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', padding: '10px' }}>
            🔄 AI is analyzing your portfolio to build a learning path...
          </div>
        ) : recommendedMod && !completedModules.some(m => m.id === recommendedMod.id) && (
          <article className="course-card list-row featured-course" style={{ borderLeft: '4px solid var(--primary-color)', backgroundColor: 'var(--surface-color)' }}>
            <div className="course-card-content">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⭐ AI Recommended</span>
              </div>
              <strong>{recommendedMod.title}</strong>
              <div className="course-card-meta">
                <span>🎯 Portfolio Match: 100%</span>
                <span>⏱️ {recommendedMod.cpdHours ?? 2.0} CPD hrs</span>
              </div>
              <div className="course-card-status" style={{ flexDirection: 'column', alignItems: 'flex-start', marginTop: '8px', padding: '8px', backgroundColor: 'var(--bg-color)', borderRadius: '4px', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: '500' }}>Strategic Reasoning:</span>
                <span style={{ fontStyle: 'italic', lineHeight: '1.4' }}>{cpdRecommendation.strategicReasoning}</span>
              </div>
            </div>
            <button 
              className="btn primary-action course-start-btn"
              onClick={() => onStartCourse(recommendedMod)}
              style={{ alignSelf: 'flex-start', marginTop: '10px' }}
            >
              Start Course →
            </button>
          </article>
        )}

        {cpd.filter(course => !completedModules.some(m => m.id === course.id)).slice(0, 4).map((course) => {
          const status = course.id === "cpd-mod-elective-young-family" ? "In Progress: 60%" : "Not started";
          const btnText = status.includes("In Progress") ? "Continue →" : "Start Course →";
          const icon = status.includes("In Progress") ? "📘" : "📗";
          return (
            <article className={`course-card list-row`} key={course.id}>
              <div className="course-card-content">
                <strong>{course.title}</strong>
                <div className="course-card-meta">
                  <span>🎯 Portfolio Match: {course.matchScore}%</span>
                  <span>⏱️ {course.cpdHours ?? 2.0} CPD hrs</span>
                </div>
                <div className="course-card-status">
                  <span>{icon} {status}</span>
                  {status.includes("In Progress") && (
                    <div className="progress-bar-mini">
                      <div className="fill" style={{ width: '60%' }}></div>
                    </div>
                  )}
                </div>
              </div>
              <button 
                className={`btn secondary-action course-start-btn`}
                onClick={() => onStartCourse(course)}
              >
                {btnText}
              </button>
            </article>
          );
        })}
        {cpd.filter(course => !completedModules.some(m => m.id === course.id)).length === 0 && !recommendedMod && (
          <p className="empty-state" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
            🎉 You have completed all portfolio-matched courses!
          </p>
        )}
      </div>
    </section>
  );
}



function CpdProgressGauge({ completed, target }) {
  const pct = Math.min(100, Math.round((completed / target) * 100));
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <section className="panel cpd-gauge-panel">
      <PanelHeader title="CPD Progress" meta={`${pct}% complete`} />
      <div className="cpd-gauge-container">
        <svg className="cpd-gauge-svg" viewBox="0 0 160 160">
          <circle
            className="cpd-gauge-bg"
            cx="80" cy="80" r={radius}
            fill="none" strokeWidth="12"
          />
          <circle
            className="cpd-gauge-fill"
            cx="80" cy="80" r={radius}
            fill="none" strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="cpd-gauge-label">
          <strong>{completed.toFixed(1)}</strong>
          <span>/ {target.toFixed(1)} hrs</span>
          <small className="regulatory-label">Annual Requirement</small>
        </div>
      </div>
    </section>
  );
}


function StudyHistoryPanel({ completedModules, mockGaps = [] }) {
  const resolvedGaps = mockGaps.filter(g => completedModules.some(m => m.id === g.courseId));

  return (
    <section className="panel" id="study-history" style={{ marginTop: '20px' }}>
      <PanelHeader title="Study History" meta={`${completedModules.length} courses completed`} />
      <div className="stack">
        {completedModules.length === 0 ? (
          <p className="empty-state" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
            You haven't completed any courses yet. Start a course to see your history and resolved gaps here!
          </p>
        ) : (
          <>
            {resolvedGaps.length > 0 && (
          <div style={{ padding: '12px', backgroundColor: 'var(--surface-color)', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '15px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
              ✅ Resolved Knowledge Gaps
            </h4>
            <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              {resolvedGaps.map(g => (
                <li key={g.id} style={{ marginBottom: '4px' }}>{g.label}</li>
              ))}
            </ul>
          </div>
        )}
        
        <h4 style={{ margin: '5px 0 10px 0', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
          Completed Courses
        </h4>
        {completedModules.map((mod) => (
          <article className="list-row" key={mod.id}>
            <div>
              <strong>{mod.title}</strong>
              <span style={{ color: "var(--success-color, #2b7a57)" }}>✅ Completed on {new Date(mod.completedAt).toLocaleDateString()}</span>
            </div>
            <b>+{mod.cpdHours ?? 2.0} hrs</b>
          </article>
        ))}
          </>
        )}
      </div>
    </section>
  );
}


function QuizModal({ quiz, onSuccess, onClose }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedOption) {
      setError("Please select an answer.");
      return;
    }
    if (selectedOption === quiz.correctId) {
      onSuccess();
    } else {
      setError("Incorrect. Please try again or review the module.");
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content quiz-modal">
        <header className="modal-header">
          <h2>Knowledge Gate</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </header>
        <div className="modal-body">
          <div className="quiz-context">
            <strong>Contextual Assessment:</strong>
            <p>Based on your completion of "{quiz.moduleTitle}"</p>
          </div>
          <p className="quiz-question">{quiz.question}</p>
          <form onSubmit={handleSubmit} className="quiz-form">
            <div className="quiz-options">
              {quiz.options.map((opt) => (
                <label key={opt.id} className={`quiz-option ${selectedOption === opt.id ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="quizAnswer"
                    value={opt.id}
                    checked={selectedOption === opt.id}
                    onChange={() => {
                      setSelectedOption(opt.id);
                      setError(null);
                    }}
                  />
                  <span>{opt.text}</span>
                </label>
              ))}
            </div>
            {error && <p className="quiz-error">{error}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={!selectedOption}>
                Submit Answer
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}



