import { FAQ_ITEMS } from '@/lib/faq';
import { faqPageSchema, webApplicationSchema } from '@/lib/structured-data';

import Faq from './faq';
import JsonLd from './json-ld';
import ProfilePicMaker from './profile-pic-maker';
import RelatedLinks from './related-links';
import SiteFooter from './site-footer';

/**
 * The homepage is a server component so it can carry the page's structured
 * data and metadata; the tool itself is the client component below it.
 */
export default function Home() {
  return (
    <main className="min-h-screen flex flex-col text-center">
      <JsonLd data={webApplicationSchema()} />
      <JsonLd data={faqPageSchema(FAQ_ITEMS)} />
      <ProfilePicMaker />
      <Faq />
      {/* currentPath '/' isn't a landing page, so all three are listed. */}
      <RelatedLinks currentPath="/" />
      <SiteFooter />
    </main>
  );
}
