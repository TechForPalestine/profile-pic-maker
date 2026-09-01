import { FAQ_ENTRIES } from '@/lib/faq';

// Native <details>/<summary> keeps the accordion dependency-free and
// keyboard-accessible, and the full Q&A text ships in the prerendered HTML
// where crawlers and AI answer engines can read it without running JS.
export default function Faq() {
  return (
    <section aria-labelledby="faq-heading" className="pt-8 text-left">
      <h2 id="faq-heading" className="text-2xl font-bold text-center mb-4">
        Frequently Asked Questions
      </h2>
      <div className="space-y-2">
        {FAQ_ENTRIES.map((entry) => (
          <details
            key={entry.question}
            className="border rounded-lg p-3 text-sm"
          >
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
    </section>
  );
}
