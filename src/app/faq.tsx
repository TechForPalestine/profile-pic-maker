import type { FaqEntry } from '@/lib/faq';

// Native <details>/<summary> keeps the accordion dependency-free and
// keyboard-accessible, and the full Q&A text ships in the prerendered HTML
// where crawlers and AI answer engines can read it without running JS.
export default function FaqList({ entries }: { entries: FaqEntry[] }) {
  return (
    <div className="space-y-2 text-left">
      {entries.map((entry) => (
        <details key={entry.question} className="border rounded-lg p-3 text-sm">
          <summary className="font-semibold cursor-pointer">
            {entry.question}
          </summary>
          <p className="mt-2 text-gray-600">
            {entry.answer}
            {entry.link && (
              <>
                {' '}
                <a
                  href={entry.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {entry.link.label}
                </a>
              </>
            )}
          </p>
        </details>
      ))}
    </div>
  );
}
