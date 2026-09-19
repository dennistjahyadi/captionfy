# Play Console — every field, and the prompt that fills them

`ASO.md` carries the listing text and the reasoning behind it. `STORE-ASSETS.md`
carries the graphics. This file carries **the console itself**: every form Play
puts between a built bundle and a published app, with the answer already written.

Everything here was checked against the code and the merged release manifest on
2026-09-17, not against memory of what the app does.

---

## Read this before you open the console

Four things are wrong or missing right now. Two of them are policy violations if
you upload as-is.

### 1. ~~The description in ASO.md does not match the app~~ — closed

It used to. This section said `ASO.md` promised a watermark tier the code did not
have, and told you to change the listing or change the code. **The code changed.**
`src/policy/free-tier.ts`:

```ts
export const FREE_TIER: FreeTierPolicy = { kind: 'watermark' };
```

Unlimited exports, full quality, carrying a small mark that the unlock removes —
which is what `ASO.md` said all along. The argument for moving is in that file
and in `layoutWatermark`: the three-export counter was a wall in front of the
wrong thing, because checking that the captions match the audio never needed an
export at all.

**So the inversion is the thing to watch.** The full description further down
this file was written against the three-export tier and is now the one that
lies. It has been rewritten again, to the watermark tier. Whichever of these two
files you paste from, paste from the one that agrees with `free-tier.ts`, and
check it rather than remembering it.

`ASO.md` is still stale on the presets: it says four styles and
`src/domain/style.ts` has nine. Fixed below.

### 2. There is no privacy policy, and Play will not take the app without one

A public URL is required for every app, with or without data collection. The
full text is at the bottom of this file. It needs to live somewhere public and
not user-editable — GitHub Pages off this repo is fine and free.

### 3. The bundle on disk says 0.0.1 — now fixed at the build

`app.json` said `1.0.0` while the bundle sitting in `android/` said
`versionName="0.0.1"`, because `android/` is generated, is not in git, and this
copy predated the version bump. `build-aab.sh` printed "version 1.0.0" on the way
out regardless, because it read `app.json` rather than the bundle.

Both halves are closed now. Every build syncs the generated project from
`app.json` first and then reads the version back out of the finished artifact,
so a bundle can no longer carry a version nobody asked for:

```sh
npm run version:show         # 1.0.0 (1)
./aab.sh                     # syncs, builds, verifies, archives
```

The bundle lands at `build/wordburn-<version>-<code>.aab` with its SHA-256
beside it. **Whatever is in that filename is what Play will see.**

Target API is already 36, comfortably over Play's floor of 35. `minSdk` 29,
`versionCode` 1. Both fine for a first upload.

**After the first upload, versionCode 1 is spent.** Play refuses a number it has
already seen, so every later bundle needs `npm run bump` first — and `./aab.sh`
refuses to build a code it has already archived rather than letting you find out
at the end of an upload.

### 4. `captions_unlock_v1` does not exist yet, and nobody has ever bought anything

CLAUDE.md's known issue. The product has to be created in the console **and** an
AAB containing the billing library has to be on a track before the purchase flow
can run even once. The order that works is: upload to Internal testing → create
the in-app product → add a licence-tested account → buy it for free. Section 9
below has the product details.

### Two permission declarations you will be asked to justify

The merged release manifest carries permissions that pull extra forms:

| Permission | Where it comes from | What Play does |
|---|---|---|
| `READ_MEDIA_VIDEO`, `READ_EXTERNAL_STORAGE` | expo-image-picker | Photo and Video Permissions declaration |
| `FOREGROUND_SERVICE_MEDIA_PROCESSING`, `FOREGROUND_SERVICE_DATA_SYNC` | `modules/foreground-service` | Foreground service declaration, with a demo video |
| `RECORD_AUDIO` | whisper.rn | nothing — but it shows on your listing |
| `CAMERA` | expo-image-picker | nothing — but it shows on your listing |

Text for the two declarations is in section 7. The last two are worth a thought
before upload rather than after: this app never records audio and never opens a
camera, and an app whose entire pitch is *"nothing leaves your phone"* listing
Microphone and Camera on its store page is arguing against itself. Both can be
stripped in a config plugin with `tools:node="remove"`. Not done here because it
is a code change, not a console one.

---

## The prompt for the Claude browser extension

Paste this into Claude for Chrome with Play Console open. It fills forms; it does
not decide anything and it does not submit.

**What the extension cannot do:** upload files. The AAB, the icon, the feature
graphic and the screenshots all need your own file picker. The prompt tells it to
stop and hand those back to you.

**One thing that is irreversible:** the package name `com.wordburn.app` hardens
permanently at first upload, and the app name at first publish is what the
listing is created under. Check both yourself before anything is submitted.

```
You are filling in the Google Play Console for an app called Wordburn
(package com.wordburn.app). I have a file open at PLAY-CONSOLE.md with the
exact text for every field. I will paste each section to you as we go.

Rules, all of them hard:

1. NEVER click "Submit for review", "Send for review", "Start rollout",
   "Publish", or "Save and publish". Fill the fields, save drafts where a
   Save button exists, and stop. I do the submitting.
2. NEVER accept, sign, or agree to any Google agreement, policy, or terms
   dialog. Stop and tell me it is there.
3. NEVER invent an answer. If a field is not covered by the text I pasted,
   stop and ask me. A guessed answer on a Data safety or content rating
   form is a policy violation, not a typo.
4. NEVER enter payment details, bank details, or tax information.
5. When a step needs a file upload, stop and tell me the exact filename and
   where it is. You cannot use the file picker and should not try.
6. Copy text EXACTLY as I paste it, including line breaks and the blank
   lines between paragraphs. Do not fix, shorten, rephrase or "improve"
   anything. Play counts characters and I have counted them already.
7. After each section, tell me: which fields you filled, which you skipped
   and why, and whether the page saved cleanly.

Work one section at a time and wait for me between sections. Start by
telling me which Play Console page is currently open and what state the
app is in, then wait.
```

Then paste the sections below one at a time, in order. Sections 1–4 are safe to
let it type. Sections 5–8 are questionnaires whose answers are legal statements
about the app — read each answer yourself before you let it click.

---

## 1. Create the app

Play Console → All apps → Create app.

| Field | Value |
|---|---|
| App name | `Wordburn: Subtitles & Captions` |
| Default language | English (United Kingdom) — or US; the copy is British spelling (`colour`) |
| App or game | **App** |
| Free or paid | **Free** (the unlock is an in-app product, so the app is free) |
| Declarations | Developer Programme Policies: yes. US export laws: yes. |

Free-or-paid cannot be changed from paid to free later, and a free app can never
become paid. Free is correct here and stays correct.

---

## 2. Store listing — the text

Counts are measured against Play's limits.

### App name — 30/30

```
Wordburn: Subtitles & Captions
```

### Short description — 71/80

```
Auto captions & subtitles for your video. Offline, on-device, pay once.
```

### Full description — 2186/4000

```
Wordburn adds captions to your video without sending it anywhere.

Pick a clip and the speech is transcribed on your phone. No server, no account, no upload, no sign-in. Wordburn works in airplane mode exactly as well as it works on wifi, and your video never leaves your device.

AUTOMATIC CAPTIONS, ON YOUR PHONE
Speech recognition runs offline, on-device. Drop in a clip and get word-by-word captions with timing, ready to edit.

NINE CAPTION STYLES
Clean subtitle, box highlight, karaoke fill, editorial, spotlight, word stack, headline, newsprint and neon. Every style animates word by word, and the preview is exactly what gets burned into the file.

IT HEARS THE WORD YOU LEANED ON
Other caption apps ask you to type a list of keywords to emphasise. Wordburn listens. A word said louder, held longer, or set off by a pause is picked out and styled as the big word, from how you actually said it, without tagging anything.

EDIT EVERY WORD
- Fix a misheard word without changing its timing
- Nudge, split, merge and drag word timings on a waveform
- Shift every caption at once if they run early or late
- Low-confidence words are flagged so you know what to check
- Undo and redo everything

MAKE IT YOURS
Choose the colour, the text size, the position on the frame and how many words appear per line. Your style is remembered for the next video.

A PERSONAL DICTIONARY
Teach Wordburn how to spell your brand, your handle, or a name it keeps getting wrong. Spell it once and it is spelled that way in every video after.

EXPORT
Captions are burned into the video on your phone, at full quality, and saved straight to your gallery. Audio is copied across untouched, with no second compression pass. You can export a .srt subtitle file too.

PAY ONCE
Wordburn is free to use in full: unlimited videos, unlimited exports, every caption style and every editing tool. Free exports carry a small watermark in the corner. One purchase removes it forever. There is no subscription and there never will be.

An auto subtitle maker, caption generator and subtitle burner in one app, working entirely offline.

PLEASE NOTE
Wordburn transcribes English. It does not translate and does not support other languages.
```

What changed from `ASO.md`: four styles became nine, and the acoustic-emphasis
paragraph was added because it is the one thing in the app that no competitor can
do and it was not in the listing at all. The tier paragraph is `ASO.md`'s own
again — it was rewritten here to the three-export counter while the code shipped
that, and rewritten back when `FREE_TIER` moved to the mark. It now says what
`free-tier.ts` does, with "unlimited exports" spelled out because that is the
half of the trade a reader of "carries a watermark" does not otherwise hear.

### Graphics — you upload these, the extension cannot

| Asset | File | State |
|---|---|---|
| App icon 512×512 | `store/play-icon-512.png` | ✅ exists |
| Feature graphic 1024×500 | `store/play-feature-graphic-1024x500.png` | ✅ exists |
| Phone screenshots, 2–8, 9:16 | `store/play-screenshots/*.png` | ⚠️ eight exist, three are stale — see below |
| Tablet screenshots | — | not needed, `supportsTablet: false` |
| Promo video | — | optional, skip |

Eight exist now, composed by `scripts/make-screenshots.py` over device captures
in `store/shots/listing/`. **Three of them have to be retaken before upload**, and
for two different reasons:

- **7 (Export) and 8 (Home)** were shot on the three-export tier. They read
  "no watermark" and "3 free exports left"; the app now says "with a watermark"
  and "Free exports carry a small watermark". A screenshot promising the tier the
  app no longer has is the same violation from the other direction.
- **1 (Editor), 3 (Style) and 5 (Timing)** were shot before the stage rework
  landed on 2026-09-18 and show the old layout with its own scrubber row. 4
  (Word sheet) was shot after and shows the new one, so the set disagrees with
  itself as well as with the app.

None of the eight shows the watermark, because they all predate it, and the mark
is now in every preview a free user sees. That is its own reason to reshoot.

Minimum to publish is 2. Take 3, 1 and 7 if you are in a hurry — the style grid,
the editor, the export.

---

## 3. Store settings

| Field | Value |
|---|---|
| App category | **Video Players & Editors** |
| Tags | Video Editing; Video Players; Photo & Video Tools — pick up to 5 from Play's fixed list; do not invent |
| Email address | see note below |
| Phone | leave blank, it is optional |
| Website | leave blank unless you register `wordburn.app` |
| External marketing | "My app can be advertised" — fine either way |

**The contact email is published on your listing, in public, forever.** It is not
your Play account email and does not have to be. Either register `wordburn.app`
and use `support@wordburn.app`, or make a dedicated Gmail for it. Putting your
personal address on a public store page is a decision, not a default, so it is
left for you to make rather than filled in here.

Whichever you choose has to match the address in the privacy policy.

---

## 4. Pricing and countries

The app is free, so there is no price. Countries are under
Release → Production → Countries / regions.

Start with **all countries**. The English-only limitation is handled by the
PLEASE NOTE block in the description, and restricting distribution costs you the
English speakers in every country you leave out. Revisit if the one-star reviews
say otherwise.

---

## 5. App content — the declarations

Every one of these is under App content in the left nav, and all of them must be
green before you can release to production.

### Privacy policy

URL field. Paste wherever you host the text in section 10. Required even though
nothing is collected.

### App access

> **All functionality is available without special access**

Correct. No login, no account, no region lock, no code. Do not add credentials.

### Ads

> **No, my app does not contain ads**

Verified: no ad SDK in `package.json`, and no `com.google.android.gms.permission.AD_ID`
in the merged release manifest.

### Content rating

You fill a questionnaire and IARC issues the ratings. Answers:

| Question | Answer |
|---|---|
| Category | **Utility, Productivity, Communication or Other** |
| Violence, sexuality, language, controlled substances, crude humour | **No** to all |
| Does the app share the user's current location? | **No** |
| Does the app allow users to interact or exchange content with other users? | **No** |
| Does the app allow users to purchase digital goods? | **Yes** |
| Does the app contain any content not covered above? | **No** |

The interaction answer deserves its reasoning, because it looks arguable: the app
hands a finished file to Android's system share sheet. That is the OS passing a
file to another app the user chose. Wordburn has no users of its own, no accounts,
no feed, no messaging and no server for anything to be exchanged through, so
there is nothing for the question to be about.

Expect Everyone / PEGI 3.

### Target audience and content

| Question | Answer |
|---|---|
| Target age groups | **18 and over**, only |
| Is your app appealing to children? | **No** |

Selecting any group under 13 puts the app under the Families policy, which brings
an ads SDK audit, a separate content rating and a stricter data safety review, for
an audience a caption tool for short-form creators does not have.

### News app

> **No**

### Data safety

The whole form, and it is short because the honest answer is nothing.

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | n/a, the form stops asking |
| Do you provide a way for users to request that their data is deleted? | n/a |

**Why "no" is correct and not a dodge.** Google's own definition: data is
*collected* only when it is transmitted off the device. Wordburn's video, audio,
transcript, dictionary and settings are read and written inside the app's own
directory and never sent anywhere. There is no analytics SDK, no crash reporter
and no server. The only network call in the entire app is the Google Play Billing
query in `src/policy/store.ts`, and data handled by Google Play billing itself is
explicitly out of scope for this form.

If it helps to have it in writing for the reviewer, the summary line is: *no data
leaves the device.*

**Crash reporting was asked for and answered with Android vitals, which is why
that paragraph is still true.** Quality → Android vitals → Crashes & ANRs
collects crashes and ANRs from users who turned on diagnostics sharing. It needs
no SDK linked into the app, so nothing extra leaves anybody's phone and the
answer above stays "No" as written. Most of what can crash here is native —
whisper.cpp, ggml, Skia, and the burn-in module's GL and MediaCodec pipeline — so
`plugins/with-debug-symbols.js` sets `debugSymbolLevel 'SYMBOL_TABLE'` on the
release build and the symbols ride up with the bundle. Play strips them before
delivery: the upload grows, the install does not. Without them a native crash is
a column of hex addresses.

A linked crash reporter — Crashlytics or anything like it — would flip this form
to "Yes" for crash logs and a device identifier, and would need a line in the
privacy policy. If one is ever added, the honest shape is off by default, with a
switch in Settings, so this page can still be filled in as it stands.

### Government apps

> **No**

### Financial features

> **My app doesn't provide any financial features**

A one-time in-app purchase is not a financial feature. That section is about
lending, banking, crypto and investment.

### Health apps

> **No**

---

## 6. Advertising ID

A separate declaration next to Data safety.

> **No, my app does not use advertising ID**

Verified in the merged manifest: no `AD_ID` permission, and nothing in
`package.json` that would add one.

---

## 7. The two permission declarations

These are the ones that need written justification, and Play reviews them by
hand. Text below is ready to paste.

### Foreground service permissions

Declared: `FOREGROUND_SERVICE_MEDIA_PROCESSING` and `FOREGROUND_SERVICE_DATA_SYNC`
from `modules/foreground-service`.

Use case to select for both: **Media processing** (and its fallback).

Justification:

```
Wordburn transcribes speech and burns captions into video entirely on the
user's device. Both are long-running media operations on a file the user
explicitly chose: transcribing a one-minute clip takes tens of seconds and
burning captions into it takes several more.

The foreground service exists so that this work is not killed when the user
leaves the app or their screen turns off, and so that a visible notification
tells them what is still running. The user starts it by picking a video and
it stops the moment the work finishes or they cancel.

FOREGROUND_SERVICE_MEDIA_PROCESSING is used on Android 15 and above, where
that type exists. FOREGROUND_SERVICE_DATA_SYNC is the fallback on Android 14
and below, which have no media processing type. Only one is ever used per
device and neither runs except while a transcription or an export is in
progress.

The service performs no network activity of any kind.
```

**This declaration asks for a link to a video demonstrating the feature.** Plan
for it: screen-record the A54 picking a clip, transcription starting, the
notification appearing, backgrounding the app, and coming back to a finished
transcript. Unlisted YouTube is fine.

### Photo and video permissions

Declared: `READ_MEDIA_VIDEO` and `READ_EXTERNAL_STORAGE` (capped at SDK 32), both
from expo-image-picker.

Justification:

```
Wordburn's only purpose is to add captions to a video the user already has.
The user taps one button, picks one video from their own library, and the app
copies that one file into its own storage to transcribe and caption it.

Video access is requested at that moment, for that file, and the app reads
nothing else in the library. It does not browse, scan, index or upload the
user's media. READ_EXTERNAL_STORAGE is capped at API 32 and exists only for
devices older than the granular media permissions.
```

Worth knowing before you write this: on Android 13+ the app goes through the
system photo picker, which needs no permission at all. If the permissions were
stripped in a config plugin the declaration would go away with them, along with
"Camera" and "Microphone" on your public listing. Code change, so it is flagged
rather than done.

---

## 8. Release notes

Release → Internal testing / Production → Release notes, `<en-GB>` block.

### First release, 500 max

```
The first release of Wordburn.

Pick a video and get captions, transcribed on your phone with nothing uploaded anywhere. Nine caption styles, word-level editing that never breaks your timing, a personal dictionary for the words it gets wrong, and captions burned into the file at full quality.

Three exports free. One purchase unlocks the rest, forever.
```

---

## 9. In-app products

Monetise → Products → In-app products → Create product.

| Field | Value |
|---|---|
| Product ID | `captions_unlock_v1` — matches `src/policy/store.ts:35`, and cannot be changed after creation |
| Name (55 max) | `Wordburn Unlock` |
| Description (200 max) | `Removes the watermark from every export, forever. Full quality, every caption style, every editing tool. One payment, no subscription.` |
| Type | **One-time product**, non-consumable — the code calls `finishTransaction({ isConsumable: false })` |
| Status | Active |
| Price | your call — see below |

**The product ID is permanent.** A typo here is a rename of the constant in the
app and a new product with a new ID.

On price: the app's whole pitch is *pay once, never again*, against competitors
charging monthly. Something in the one-off 5–15 USD band is the shape that
argument wants. Set the USD price and let Play convert the rest; never format a
price in the app, which is why `displayPrice` comes from the store.

**Nothing about this flow has ever run.** Once the product is active and an AAB
is on a track, add your own account under Setup → Licence testing, install from
the Internal testing link, and buy it. A licence-tested account is not charged.
That is the only way to close the known issue in CLAUDE.md.

---

## 10. The privacy policy

Host this at a public, stable, non-editable URL and paste that URL into App
content → Privacy policy. GitHub Pages off this repo works and costs nothing.

Replace `[CONTACT EMAIL]` with whatever you decided in section 3, and make it the
same address as the listing's contact email.

```
# Wordburn Privacy Policy

Last updated: 17 September 2026

## The short version

Wordburn does not collect your data. It has no server, no account and no
analytics. Your videos, your audio and your transcripts stay on your phone.

## What Wordburn does with your video

When you pick a video, Wordburn copies it into its own private storage on
your device, extracts the audio, and transcribes the speech using a speech
recognition model that is built into the app and runs entirely on your
phone. Captions are burned into the video on your phone as well.

None of this involves the internet. No video, no audio, no transcript and no
part of any file you open is ever uploaded, transmitted or shared with us or
with anyone else. Wordburn works identically in airplane mode.

## What is stored, and where

Everything Wordburn creates is stored in the app's own private directory on
your device:

- The copy of the video you picked
- Extracted audio and the transcript
- Your captions, styles and editing history
- Your personal dictionary
- App settings and your purchase status

None of it is readable by other apps. Uninstalling Wordburn deletes all of
it. Deleting a project inside the app deletes that project's files. Videos
you choose to export are saved to your device's gallery, where they are
yours like any other video.

## Information we collect

None. Wordburn contains no analytics, no crash reporting, no advertising,
no tracking of any kind, and no advertising identifier. We do not know who
you are, that you installed the app, or that you used it.

## Purchases

Wordburn offers one optional one-time purchase that unlocks unlimited
exports. Purchases are handled entirely by Google Play. Wordburn asks Google
Play whether this purchase has been made and stores that yes-or-no answer on
your device.

We never see, receive or store your payment details, your name, your email
address or your Google account. What Google collects when you make a
purchase is covered by Google's own privacy policy at
https://policies.google.com/privacy.

This is the only feature in Wordburn that uses the internet.

## Permissions

- **Videos and media**: to let you pick the video you want to caption, and
  to save the captioned video back to your gallery. Wordburn reads only the
  file you pick.
- **Notifications**: to show progress while a transcription or an export is
  running.
- **Foreground service**: to keep a transcription or an export running if
  you leave the app or your screen turns off.
- **Internet**: used only to ask Google Play about purchases, as above.

## Children

Wordburn is not directed at children under 13 and we do not knowingly
collect information from anyone, of any age, because we do not collect
information at all.

## Changes

If this policy changes, the updated version will be posted at this address
with a new date at the top. Material changes will also be described in the
app's release notes on Google Play.

## Contact

Questions about this policy: [CONTACT EMAIL]
```

---

## The order to actually do this in

1. `./aab.sh` — it syncs, verifies and archives the version by itself now
2. Host the privacy policy, get the URL
3. Decide the contact email
4. Take the screenshots
5. Create the app (section 1)
6. Store listing text and graphics (sections 2, 3)
7. Upload the AAB to **Internal testing**, not production
8. Create `captions_unlock_v1` (section 9)
9. Licence-test the purchase — close the CLAUDE.md known issue
10. Record the foreground service demo video
11. App content declarations (sections 5, 6, 7)
12. Countries (section 4), release notes (section 8)
13. Then, and only then, production

Steps 7 through 9 are the point of doing internal testing first: the purchase has
never run, and production is a bad place to find out why.
