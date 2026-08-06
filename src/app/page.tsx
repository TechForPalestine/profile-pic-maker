import ProfilePicMaker from './profile-pic-maker';
import SiteFooter from './site-footer';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col text-center">
      <ProfilePicMaker />
      <SiteFooter />
    </main>
  );
}
