/**
 * The Tech For Palestine footer, shared by every page so the landing pages
 * read as part of the same app rather than a separate marketing site.
 */
export default function SiteFooter() {
  return (
    <footer className="bg-[#303846] text-center py-8 px-4">
      <div className="container max-w-xl mx-auto">
        <div className="mb-4">
          <a
            href="https://techforpalestine.org"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block"
          >
            <img
              src="/img/logo.svg"
              alt="Tech For Palestine Logo"
              width={320}
              height={180}
              className="mx-auto"
            />
          </a>
        </div>
        <p className="text-sm text-[#ebedf0]">
          An open source initiative of the Tech For Palestine collective
        </p>
      </div>
    </footer>
  );
}
