/**
 * Renders a JSON-LD block. Kept in a server component so the payload ships as
 * markup in the HTML crawlers read, not as part of the client bundle.
 *
 * `<` is escaped so a stray value can never close the script tag early.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}
