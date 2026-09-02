'use client';
import { SurveyEvent, trackEvent } from '@/lib/analytics';
import {
  NEXT_STEPS,
  SURVEY_STORAGE_KEY,
  SurveyQuestion,
  TALLY_FORM_ID,
  pickRotatingQuestion,
  tallyFormUrl,
} from '@/lib/survey';
import { useEffect, useState } from 'react';
import { FaXmark } from 'react-icons/fa6';

/**
 * One-tap survey shown under the share options once the picture is
 * downloaded. Rationale for the questions themselves lives in `@/lib/survey`.
 *
 * It sits *below* the download and share buttons on purpose: the share panel
 * is the conversion moment, and nothing here is allowed to compete with it.
 */
export default function SurveyPanel({ method }: { method: string }) {
  // 'pending' until localStorage has been read — the answered/not-answered
  // split can't be known during SSR, so nothing renders on the first pass.
  const [step, setStep] = useState<'pending' | 'asking' | 'done'>('pending');
  const [question, setQuestion] = useState<SurveyQuestion>();
  // Kept so a written comment can be read next to the tap that preceded it.
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const close = () => {
    try {
      localStorage.setItem(SURVEY_STORAGE_KEY, new Date().toISOString());
    } catch {
      // Private-mode / blocked storage. Worst case the survey is offered
      // again on a later visit — not worth failing the render over.
    }
  };

  useEffect(() => {
    let alreadyAsked = false;
    try {
      alreadyAsked = localStorage.getItem(SURVEY_STORAGE_KEY) !== null;
    } catch {
      // Treat unreadable storage as "not asked yet".
    }
    if (alreadyAsked) return;

    // Revealing has to happen in an effect: localStorage and Math.random() are
    // both unavailable/divergent during SSR, so the first paint can't know
    // whether this visitor has already been asked.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuestion(pickRotatingQuestion());
    setStep('asking');
    trackEvent(SurveyEvent.Shown, { method });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    trackEvent(SurveyEvent.Dismissed, {
      question: question?.id ?? 'unknown',
      method,
    });
    close();
    setStep('pending');
  };

  const answer = (asked: SurveyQuestion, option: string) => {
    setAnswers({ [asked.id]: option });
    trackEvent(SurveyEvent.Answered, {
      question: asked.id,
      answer: option,
      method,
    });
    close();
    setStep('done');
  };

  if (step === 'pending') return null;

  return (
    <div className="survey-panel-enter relative my-6 rounded-2xl border border-gray-300 bg-gray-50 px-4 py-5 text-left">
      {step !== 'done' && (
        <button
          onClick={dismiss}
          aria-label="Dismiss the survey"
          className="absolute top-3 right-3 rounded-full p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 cursor-pointer"
        >
          <FaXmark />
        </button>
      )}

      {question && step !== 'done' ? (
        <div aria-live="polite">
          <p className="font-semibold pr-8">{question.prompt}</p>
          <p className="text-sm text-gray-600 pb-3">
            One tap — it helps us reach more people.
          </p>
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => (
              <button
                key={option.value}
                onClick={() => answer(question, option.value)}
                className="rounded-full border border-gray-400 bg-white px-3.5 py-1.5 text-sm hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-colors cursor-pointer"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div aria-live="polite">
          <p className="font-semibold">Thank you 🇵🇸</p>
          <p className="text-sm text-gray-600 pb-3">
            Want to do more than a profile picture?
          </p>
          <div className="flex flex-wrap gap-2">
            {NEXT_STEPS.map((next) => (
              <a
                key={next.value}
                href={next.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent(SurveyEvent.NextStepClicked, {
                    step: next.value,
                    method,
                  })
                }
                className="rounded-full border border-gray-400 bg-white px-3.5 py-1.5 text-sm hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-colors"
              >
                {next.label} →
              </a>
            ))}
          </div>
          {TALLY_FORM_ID && (
            <p className="text-sm text-gray-600 pt-4">
              <a
                href={tallyFormUrl(TALLY_FORM_ID, answers)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent(SurveyEvent.FeedbackOpened, { method })
                }
                className="underline cursor-pointer hover:text-gray-900"
              >
                Tell us more about what would improve this
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
