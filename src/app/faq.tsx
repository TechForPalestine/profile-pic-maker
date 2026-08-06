import { FAQ_ITEMS } from '@/lib/faq';

/**
 * The FAQ section, rendered on the homepage and linked from the landing pages
 * as `/#faq`.
 */
export default function Faq() {
  return (
    <section id="faq" className="px-8 pb-12 max-w-xl mx-auto w-full text-left">
      <h2 className="font-semibold text-2xl text-center mb-6">
        Frequently asked questions
      </h2>
      <div className="flex flex-col gap-3">
        {FAQ_ITEMS.map(({ question, answer }) => (
          <details key={question} className="border rounded-lg p-4">
            <summary className="font-semibold cursor-pointer">
              {question}
            </summary>
            <p className="pt-3 text-gray-600">{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
