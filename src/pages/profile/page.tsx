import { useState } from "react";
import { Link } from "react-router-dom";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { HOME_FEATURED_ARTISTS, HOME_TRENDING_TRACKS } from "@/mocks/home";
import { STORIES } from "@/mocks/magazine";

type Tab = "Articles" | "Playlists" | "Listening" | "Following" | "About";
const tabs: Tab[] = ["Articles", "Playlists", "Listening", "Following", "About"];

const profile = {
  name: "Akinyi Odhiambo",
  handle: "@akinyi",
  role: "Senior Writer",
  avatar: "https://picsum.photos/seed/profile-ava-1/160/160",
  cover: "https://picsum.photos/seed/profile-cover-1/1200/320",
  bio: "Music journalist based in Nairobi. Writing about East African music, culture, and the stories behind the sounds since 2019. Believes the music comes first.",
  articles: 84,
  followers: "2,410",
  following: 318,
  streams: "12.4K",
  location: "Nairobi, Kenya",
  website: "wakilisha.africa/contributors/akinyi",
};

function playlistCollages() {
  const tracks = HOME_TRENDING_TRACKS.filter((track) => track.artworkUrl);
  return [
    { title: "Nairobi after midnight", count: 24, mood: "Late-night city music", items: tracks.slice(0, 4) },
    { title: "East African new heat", count: 32, mood: "Fresh registry picks", items: tracks.slice(2, 6) },
    { title: "Writing desk rotation", count: 18, mood: "Songs behind the essays", items: tracks.slice(1, 5) },
    { title: "Chart watchers", count: 40, mood: "Current movement signals", items: tracks.slice(3, 7) },
  ];
}

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("Articles");
  const articles = STORIES.slice(0, 6);
  const tracks = HOME_TRENDING_TRACKS.slice(0, 8);
  const artists = HOME_FEATURED_ARTISTS.slice(0, 8);
  const playlists = playlistCollages();

  return (
    <main className="profile48-shell">
      <div className="profile48-wrap">
        <section className="profile48-hero">
          <div className="profile48-cover"><img src={profile.cover} alt="" /></div>
          <div className="profile48-top">
            <div className="profile48-avatar"><img src={profile.avatar} alt="" /><div className="profile48-badge"><WkIcon name="Check" size={12} /></div></div>
            <div className="min-w-0">
              <h1 className="profile48-name">{profile.name}</h1>
              <div className="profile48-handle">{profile.handle}<span className="profile48-role"><WkIcon name="PenLine" size={13} /> {profile.role}</span></div>
            </div>
            <div className="profile48-actions">
              <button className="btn btn-ghost btn-sm"><WkIcon name="Pencil" size={14} /> Edit profile</button>
              <ShareButton item={{ title: profile.name, subtitle: `${profile.handle} · ${profile.role}`, description: profile.bio, imageUrl: profile.avatar, type: "page" }} />
            </div>
          </div>
          <div className="profile48-body">
            <p className="profile48-bio">{profile.bio}</p>
            <div className="profile48-stats">
              <Stat value={profile.articles} label="Articles" />
              <Stat value={profile.followers} label="Followers" />
              <Stat value={profile.following} label="Following" />
              <Stat value={profile.streams} label="Streams" />
            </div>
          </div>
          <nav className="profile48-tabs" aria-label="Profile content tabs">
            {tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`profile48-tab ${tab === item ? "active" : ""}`}>{item}</button>)}
          </nav>
        </section>

        <div className="profile48-layout">
          <section className="profile48-main">
            {tab === "Articles" && <ArticlesTab articles={articles} />}
            {tab === "Playlists" && <PlaylistsTab playlists={playlists} />}
            {tab === "Listening" && <ListeningTab tracks={tracks} />}
            {tab === "Following" && <FollowingTab artists={artists} />}
            {tab === "About" && <AboutTab />}
          </section>

          <aside className="profile48-rail">
            <div className="profile48-card">
              <div className="profile48-card-title"><WkIcon name="Activity" size={15} /> Activity summary</div>
              <RailStat label="Published this month" value="6" />
              <RailStat label="Top genre" value="Afrobeats" />
              <RailStat label="Top artist" value={artists[0]?.name ?? "—"} />
              <RailStat label="Last active" value="Today" />
            </div>
            <div className="profile48-card">
              <div className="profile48-card-title"><WkIcon name="ShieldCheck" size={15} /> Privacy</div>
              <div className="profile48-privacy"><WkIcon name="Lock" size={16} /> Listening history is private by default. Public activity only appears when a user opts in.</div>
            </div>
            <div className="profile48-card">
              <div className="profile48-card-title"><WkIcon name="Link" size={15} /> Links</div>
              <div className="profile48-link-list">
                <a className="profile48-link" href="#"><WkIcon name="MapPin" size={15} /> {profile.location}</a>
                <a className="profile48-link" href="#"><WkIcon name="Globe" size={15} /> {profile.website}</a>
                <a className="profile48-link" href="#"><WkIcon name="AtSign" size={15} /> Contributor profile</a>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="profile48-stat"><div className="profile48-stat-val">{value}</div><div className="profile48-stat-lbl">{label}</div></div>;
}

function RailStat({ label, value }: { label: string; value: string }) {
  return <div className="profile48-rail-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function ArticlesTab({ articles }: { articles: typeof STORIES }) {
  return (
    <div>
      <div className="section-head"><div><div className="section-kicker">Articles tab</div><h2 className="section-title">Published pieces</h2></div><p className="section-copy">Story cards use the magazine grid language and can later filter by reviews, interviews, essays, and lists.</p></div>
      <div className="profile48-story-grid">
        {articles.map((story) => (
          <Link key={story.slug} to={`/magazine/${story.slug}`} className="profile48-story">
            <div className="profile48-story-art"><img src={story.heroUrl} alt="" /></div>
            <div className="profile48-story-body"><div className="profile48-kicker">{story.section}</div><div className="profile48-story-title">{story.title}</div><div className="profile48-story-meta">{story.readingTime} min read · {story.date || "Undated"}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PlaylistsTab({ playlists }: { playlists: ReturnType<typeof playlistCollages> }) {
  return (
    <div>
      <div className="section-head"><div><div className="section-kicker">Playlists tab</div><h2 className="section-title">Curated collections</h2></div><p className="section-copy">Playlist cards use four-art collages, title, track count, and editorial intent.</p></div>
      <div className="profile48-playlist-grid">
        {playlists.map((playlist) => (
          <Link key={playlist.title} to="/search" className="profile48-playlist">
            <div className="profile48-collage">{playlist.items.map((track) => <img key={track.slug} src={track.artworkUrl} alt="" />)}</div>
            <div className="profile48-playlist-title">{playlist.title}</div>
            <div className="profile48-playlist-sub">{playlist.count} tracks · {playlist.mood}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ListeningTab({ tracks }: { tracks: typeof HOME_TRENDING_TRACKS }) {
  return (
    <div>
      <div className="section-head"><div><div className="section-kicker">Listening tab</div><h2 className="section-title">Recent activity</h2></div><p className="section-copy">A last-30-days listening view. Private by default, public only when explicitly enabled.</p></div>
      <div className="profile48-card"><div className="profile48-activity">
        {tracks.map((track) => (
          <Link key={track.slug} to={`/tracks/${track.slug}`} className="profile48-activity-row">
            <div className="profile48-activity-art">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : null}</div>
            <div className="min-w-0"><div className="profile48-activity-title">{track.title}</div><div className="profile48-activity-sub">{track.artist}</div></div>
            <WkIcon name="Play" size={15} />
          </Link>
        ))}
      </div></div>
    </div>
  );
}

function FollowingTab({ artists }: { artists: typeof HOME_FEATURED_ARTISTS }) {
  return (
    <div>
      <div className="section-head"><div><div className="section-kicker">Following tab</div><h2 className="section-title">Artists followed</h2></div><p className="section-copy">Followed artists preserve photographic cards and genre/context metadata.</p></div>
      <div className="profile48-follow-grid">
        {artists.map((artist) => (
          <Link key={artist.slug} to={`/artists/${artist.slug}`} className="profile48-follow">
            <div className="profile48-follow-img"><img src={artist.imageUrl} alt="" /></div>
            <div className="profile48-follow-body"><div className="profile48-follow-name">{artist.name}</div><div className="profile48-follow-sub">{artist.genres?.[0] || "Artist"}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="profile48-card">
      <div className="profile48-card-title"><WkIcon name="UserRound" size={15} /> About tab</div>
      <div className="profile48-about">
        <p>{profile.bio}</p>
        <p className="mt-4">This profile pattern supports long bio, location, website, social links, contributor status badges, profile sharing, and user-controlled visibility for cultural activity.</p>
      </div>
    </div>
  );
}
