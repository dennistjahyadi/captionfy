# TikTok — what the research says, and what is built here

This file was written after the renders, which is the wrong order and is why
two of the three ads had to change. What follows is the research first and the
assets second, so the next person does not repeat it.

## The finding that reorganised everything

**Polished brand films are the wrong artifact for organic TikTok.** The 2026
consensus across ad-creative sources is that native, creator-style content beats
them — a plain screen recording of a real workflow outperforms a brand film,
because "studio-quality product videos with perfect lighting and b-roll get
scrolled past," and the algorithm and the audience now actively punish content
that reads as manufactured.

The first cut of all three was exactly that: word-by-word text floating on a
blurred gradient, three statements and a logo card. It could have been an ad for
any captions tool on earth, because **it never once showed the app**. A hook that
leads with the finished result is the top-performing type there is, and a payoff
the viewer cannot identify is not a payoff.

So they were rebuilt around the product:

- **Every claim is now attached to the screen that proves it.** "No account"
  over Home with no sign-in on it. "No upload" over Processing with the words
  arriving. "No internet" over the editor with an aeroplane in the phone's own
  status bar. `src/screens.tsx` rebuilds Home, Processing, the editor, the
  unlock screen and a generic keyword panel at phone size, from the app's own
  theme tokens and the app's own strings.
- **Hard cuts every two to three seconds**, each with a frame of overshoot
  (`Punch`). A smooth zoom reads as a corporate product video, which is the
  thing being avoided.
- **Nothing is ever still.** The clip keeps playing behind the device, blurred
  far enough back to read as depth (`PhoneBackdrop`) — a shot where nothing
  moves is dead air, and dead air inside the first three seconds reads as low
  energy.
- **The end cards are gone.** Three and a half seconds of static logo was about
  a fifth of each ad, and completion rate is the signal TikTok distributes on.
  `CtaOverlay` puts the name and the store line over a shot that is still
  running.

They are still renders rather than filmed screen recordings, and that ceiling is
real. Treat them as the paid/listing asset and shoot the organic half on the
phone — the shot list is at the bottom of this file.

## Video or carousel, properly answered

The evidence is genuinely split rather than one-sided:

- Video outperforms image and carousel posts on views, reach, likes, comments
  and shares, and TikTok has been pushing Photo Mode harder at the same time.
- Carousels draw substantially more engagement per post — one measurement puts
  it at 81% — because people read them at their own pace and sit on them for
  25–60+ seconds.

The rule that reconciles the two: **carousels when the viewer needs clarity,
sequence or comparison; video when motion, voice or personality carries the
message.**

For Wordburn's core claim, motion carries it. A still cannot show a word landing
on the beat, a box highlight travelling, or a glow turning colour before the
fill reaches it — and 78.6% of viral-tier clips use animated captions against
1.6% static, so the animation *is* the category. **Video is the primary format.**

But there is one post that is a comparison and should be a carousel: **the nine
presets, one per slide, same line of type.** That is sequence and comparison,
it is saveable, and it is cut from frames this project already renders. Build it
as a second format, not as a substitute.

## Hooks: the three ads do not spread evenly, on purpose

OpusClip's hook study names five types. The highest-performing is **product /
outcome showcase** — lead with the finished result, "the payoff is literally the
opening frame," 6,037 average views. The explainer setup is the most common
shape but not the best one. Four patterns actively underperform: story openers
that assume trust, face-on greetings, delay openers ("okay so…"), and
mental-work setups ("have you ever wondered…").

Supporting numbers worth designing against:

- The algorithm makes an early decision around **1.5 seconds**; the hook must
  resolve by **3**.
- **90%** of underperforming TikToks fail in the first three seconds.
- Videos holding 60% of viewers past three seconds get **4× the reach**.
- Put the hook on screen as **text**, not only audio — a large share of viewers
  arrive muted. (Which is the product's entire thesis, so this one is free.)
- Half a second of dead air inside the first three seconds reads as low energy.

All three now open on the product. `01-offline` and `02-pay-once` open on
captions already running; `03-emphasis` opens on a word lighting up on the loud
beat with the waveform spiking under it, which is the whole claim delivered
before a word of argument. The contrarian turn comes second in each, at the cut.

## Length

Most viral TikToks land between 7 and 30 seconds; the 11–18 second band is
repeatedly cited for the highest completion, and **50% completion is the
threshold where TikTok starts distributing a video significantly more**.
Completion beats length outright: 30 s at 70% beats 3 min at 15%.

The rebuild brought them to 13.2 s, 16.4 s and 13.5 s, from 15–19 s. Cutting the
end cards did most of that. `02-pay-once` is the long one because the pill stack
needs time to read as endless; if a shorter variant is wanted, that is the shot
to trim.

## The policy problem that was in the first cut

TikTok's advertising policy prohibits "negative judgements about a targeted
brand's … price/cost, features, functionality, quality," allowing comparative
claims only "subject to the provision of evidence or clear disclaimer(s)."

`02-pay-once` originally opened on **$19.99 / PER MONTH · FOREVER** struck
through in yellow. No brand was named, and as an organic post it is judged under
the Community Guidelines instead and would likely have run — right up until
somebody put money behind it, which is when a rejection costs a campaign rather
than a post.

It now makes a claim about Wordburn only: *most caption apps bill you every
month; this one bills you once*, over a stack of pills that keeps arriving
beside a single one that does not. The dollar figure moved to the post copy,
where it is a founder's opinion about a category rather than ad creative.

## Safe zones — checked, and one caveat

The app's own `safeZoneUnion()` is close to the published organic numbers. On a
1080 × 1920 frame the guidance is roughly 130–200 px clear at the top, 324–484
px at the bottom, ~140–164 px on the right and ~44 px on the left; the app uses
211 / 422 / 259 / 54, which is more conservative on the right and level on the
bottom.

**The caveat is paid.** In-feed ads add a CTA button and a Sponsored label, and
the bottom reserve grows to roughly 370 px *on top of* the organic allowance. If
these run as paid units, lift the caption block; as organic posts they are fine
as they are.

## What a strategy actually needs, which three files are not

Organic reach has fallen to roughly **4–8%** for many accounts in early 2026,
from 15–20% in 2024. The counter to that is volume: **one to three posts a day,
every day**, because each post is an independent shot at distribution and a week
of daily posting beats a month of occasional polished ones.

Three assets is not that. What this project is actually good for is being the
**template** — the script arrays in `src/ads/*.tsx` are the only thing that
changes between posts, and a new 15-second ad is a new `ScriptLine[]`. Budget an
hour to write ten scripts, then render ten.

Register matters too: TikTok-native copy is lowercase, conversational and
specific — "saved me $340 without trying", not "save money effortlessly". The
post copy below is written that way. The on-screen captions are not, because
those are the product's own rendering and changing them would be advertising
something the app does not do.

## Post copy

Lowercase on purpose. The app is named once, late, the way a person names a tool.

**03-emphasis** — post this one first. It is the only one that shows both sides:
somebody tagging keywords by hand down a long list, then this app's transcript
with the job already done and nothing tapped.
> every captions app makes you pick which word gets highlighted. this one
> listens for it. louder, held longer, a pause before it — that's the word that
> lights up. no keyword list, nothing to tag. it's called wordburn, it's android
> only, and it runs offline.
> `#captions #videoediting #contentcreator #capcut #android #editingtips`

**01-offline**
> your captions app uploads your video to a server to transcribe it. this one
> doesn't have a server. i put the whole speech model in the app — 82mb — so it
> runs in airplane mode. wordburn, android.
> `#captions #contentcreator #videoediting #privacy #android #offline`

**02-pay-once**
> captions subscriptions run about $19–25 a month now. that's ~$240 a year to
> put words on videos you already made. built wordburn instead: one payment, no
> credits, no videos-per-month cap.
> `#captions #creatortools #subscriptions #videoediting #android`

The price figures belong here and not in the video — see the policy section.

## The organic half: what to film on the A54

None of this needs Remotion. It needs the phone, a screen recording, and no
editing beyond a trim. Each is a showcase-type open by construction.

1. **The 30-second run.** Pick a clip, watch it transcribe, scroll the
   transcript, export. One take, no cuts, no voiceover. Text overlay for three
   seconds: "captioning a video with no internet".
2. **Airplane mode on camera.** Pull down the shade, toggle airplane mode, then
   transcribe. The toggle is the hook — it is a physical action, which is the
   pattern-interrupt shape.
3. **The preset scroll.** Open the style sheet and tap through all nine while
   the clip plays. This is the highest-value fifteen seconds the app can show,
   and it is already one Skia canvas doing the work.
4. **Fix a misheard word.** Tap the low-confidence chip, correct a word, show
   the timing not moving. Invariant 1, filmed. No competitor flags what to check.
5. **Say something loudly.** Film yourself leaning on one word, transcribe, show
   that word lighting up without touching anything. This is the only one of the
   five a competitor cannot shoot.

Shoot 3 and 5 first. Post daily, one to three times, and let the two hook types
in `out/` run as paid tests underneath.

**Number 2 is now a project rather than a note.** `video-01-airplane/` is the
airplane-mode shot built out: a five-phase pipeline where this machine does the
top and tail and the phone does the middle, with a voice script to record from,
three hook variants, and a concept render that is the finished video with its
footage missing so the pacing can be signed off before anything is filmed. Its
compositions live in `remotion/src/airplane/` and share this project's install,
palette and faces; its data, media and scripts live in its own folder.

The rule it is built around is worth repeating here, because it applies to
anything shot on the phone: **every caption on the demo playback comes from
Wordburn's own export**, and its self-check greps for that rather than trusting
it. The three ads in `src/ads/` draw the app's captions themselves, which is
honest because they are renders of the app. A video that films a real phone and
then draws its own captions over the playback would not be.

## Before posting anything

- **"On Google Play" is on all three end cards and is not true yet.** Do not
  post until the listing is live.
- **Swap the b-roll.** `public/demo-1080x1920.mp4` is the synthetic bokeh clip
  from `test-clips/`. It holds white type well and looks like footage, but the
  point of these is that the captions are real, so the video under them should
  be too. Drop a replacement in `public/` and change `Stage`'s default `src`.
- **No audio.** Add a trending sound at upload rather than baking one in, so it
  is attributable.

## Indonesia and SEA, if the language scope ever opens

Not yet actionable — the app is English-only — but the finding is that this is
not a translation job. Local humour, pacing and references matter more than
accurate translation, and smaller creators with real community engagement
outperform large low-engagement accounts. That makes SEA a creator-partnership
play rather than a "render the same ad in Bahasa" play, and it is downstream of
the model decision, not of this folder.

## Re-rendering

```sh
cd marketing/remotion
npm install
./sync-assets.sh    # fonts from assets/fonts, demo clip from test-clips
npm run studio      # edit with a preview
npm run render:all  # → out/*.mp4
```

Self-contained: its own `package.json`, its own React, nothing shared with the
app's build.

The voiced ads — video 03, `payonce`, `nointernet`, `nocredits` and
`justcaptions`, 23 to 27 s each on Dennis's own reads — render from their own
folder rather than through `render:all`:

```sh
cd marketing/video-03-pain-ads
./render.sh              # → out/wordburn-03-pay-once.mp4
./render.sh nointernet   # → out/wordburn-03-no-internet.mp4
./render.sh nocredits    # → out/wordburn-03-no-credits.mp4
./render.sh justcaptions # → out/wordburn-03-just-captions.mp4
```

They are cut from video 02's recordings and need nothing captured of their
own; `src/voiced/` is the kit they share and `video-03-pain-ads/README.md` has
the shape and the decisions.

`public/` and `out/` are both out of git. `out/` is a build artifact like any
APK, and `public/` is nothing but copies — the fonts are tracked once in
`assets/fonts/` and the demo clip is rebuilt by `scripts/make-demo-clip.py`.
That is the same rule the burn-in module follows by pointing its Gradle assets
directory at `assets/fonts` rather than keeping a second set: one copy of a
typeface in this repository, so there is no way for two renderers to set a word
in a face the other never saw.

## Sources

- [OpusClip — the 5 TikTok hook types that go viral in 2026](https://www.opus.pro/blog/tiktok-hooks-that-go-viral-2026)
- [TikTok Advertising Policies — misleading and false content](https://ads.tiktok.com/help/article/tiktok-ads-policy-misleading-and-false-content)
- [Fanpage Karma — carousel vs video performance](https://www.fanpagekarma.com/insights/carousel-vs-video-performance-tiktok-instagram/)
- [Influencers Time — why slideshows beat video on watch time](https://www.influencers-time.com/carousel-style-tiktoks-why-slideshows-beat-video-on-watch-ti/)
- [Creatify — TikTok ads guide 2026](https://creatify.ai/blog/tiktok-ads-complete-guide-to-creating-high-performing-creatives-in-2026)
- [Editorialge — what actually converts on TikTok in 2026](https://editorialge.com/tiktok-for-b2b-brands/)
- [STORMY — TikTok organic for apps](https://stormy.ai/blog/tiktok-organic-strategy-viral-app-growth)
- [Kreatli — TikTok safe zone 2026](https://kreatli.com/guides/tiktok-safe-zone)
- [Socialrails — best TikTok video length, documented vs folklore](https://socialrails.com/blog/best-tiktok-video-length-maximum-engagement)
- [Indonesia Investments — influencer marketing trends 2026](https://www.indonesia-investments.com/business/business-columns/indonesia-influencer-marketing-trends-and-best-practices-2026/item9892)

Most of these are vendor blogs with a commercial interest in the advice they
give, which is the same caveat the product research in CLAUDE.md carries. The
directions are consistent across independent sources; the exact percentages are
indicative. The only primary source here is TikTok's own advertising policy.
