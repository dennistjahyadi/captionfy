# Video 03 — two pain-led ads · organic 9:16 · voice script

**Hand-written, not generated.** There is no `config.json` behind this one yet,
so unlike `../video-02-tutorial/out/voiceover_script.md` this file is the source
rather than the output.

Two pains, one ad each: **pay once** and **your video never leaves your phone**.

**Nothing here is reused.** Not one line comes from video 02's recorded hooks or
its body, and none of the three ads in `../remotion/src/ads/` lent a phrase
either. Where the two projects agree it is because the product has not changed,
not because a sentence was copied — video 02 says "Most caption apps bill you
every month"; this one never puts a competitor in the sentence at all.

Every claim is true of Wordburn today: English-only, Android-only, free exports
unlimited and watermarked. See **What was kept out** at the bottom.

## How to record them

One file per line, MP3 44.1 kHz, silence trimmed both ends, named in the `file`
column. **Record each ad's body as one generation and cut it at the pauses**,
the way `../pipeline/split-voice.mjs` does for video 02 — a TTS model is
measurably steadier over forty words than over eight, and four separate
generations of one ad drift in energy against each other. Each hook is its own
file, because the hook is the variable being tested and the body is the control;
record both hook variants of an ad in the same sitting, or the A/B is measuring
the read instead of the words.

ElevenLabs starting point, same as video 02: **stability ~55, similarity ~75,
style 0–10.** Put no stage directions inside the text — punctuation is the only
direction the model reads. The lines are lowercase on the page because they are
lowercase in the mouth; ElevenLabs does not care, but the reader does.

**One person, explaining something they built.** First person singular
throughout — "i built", never "we" — the same voice the Unlock screen and the
feedback card are written in. Flat, short, certain, and read *down* rather than
up on the claim lines: selling "once" with the voice is what makes a viewer hear
a catch.

Hook budget is **3 seconds** whatever it says. Video 02's recorded hooks ran
1.8–2.7 w/s, so six or seven words is the working ceiling. The body is re-timed
to the voice, so its pace is free; estimates below assume 2.5 w/s plus room, and
the real numbers come off the recorded files.

---

## Ad 1 — pay once

The claim is about this app only. It says what the payment does and never what
anybody else charges, which is what keeps it runnable as a paid unit as well as
an organic post.

**Hook A — the rental framing**

| file | line | words | est. |
|---|---|---|---|
| payonce_hookA | i got tired of renting my captions. | 7 | 2.9 s |

**Hook B — the same claim as a product description**

| file | line | words | est. |
|---|---|---|---|
| payonce_hookB | captions you buy, not captions you rent. | 7 | 3.0 s |

A states the problem as something that happened to a person; B states the thing
being offered. One variable, same footage, same first frame — read them against
each other before reading either against ad 2.

**Body**

| file | line | words | est. |
|---|---|---|---|
| payonce_1 | so this one asks for money exactly once. | 8 | 3.2 s |
| payonce_2 | free exports carry a small watermark, and that payment takes it off for good. | 14 | 5.6 s |
| payonce_3 | nothing renews. nothing expires. there is nothing to cancel later. | 10 | 4.6 s |
| payonce_4 | wordburn. bought once, and yours after that. | 7 | 3.0 s |

**Picture:** open on the Unlock screen already on frame, so "Buy it once. Keep it
forever." is under the hook in the app's own type and the viewer reads the claim
while hearing it. Cut on `payonce_2` to an export finishing and the watermark
simply not being in the saved file. Hold the gallery copy through the close.

`payonce_2` is the honest line and it sits in the middle rather than at the end
on purpose. An ad for a paid unlock that never says what the free version does
is the thing the Unlock screen was rewritten to stop doing.

---

## Ad 2 — your video never leaves your phone

The cheapest proof the app owns: a toggle, a transcribe, a status bar that never
leaves frame. No competitor advertises this, so the ad does not have to argue
against anyone — it only has to show it.

**Hook A — the demonstration, stated**

| file | line | words | est. |
|---|---|---|---|
| offline_hookA | watch this caption itself with the internet off. | 8 | 3.1 s |

**Hook B — the absence named**

| file | line | words | est. |
|---|---|---|---|
| offline_hookB | no signal. no wifi. captions anyway. | 6 | 2.8 s |

A promises a demonstration the next two seconds deliver; B is three beats and a
picture that answers them. B is shorter, which on this pair is the interesting
difference — the hook has to resolve by three seconds and A spends most of that
budget saying so.

**Body**

| file | line | words | est. |
|---|---|---|---|
| offline_1 | nothing gets uploaded, because there is nowhere for it to go. | 11 | 4.4 s |
| offline_2 | the speech model ships inside the app and runs on your own processor. | 13 | 5.0 s |
| offline_3 | your footage stays in your gallery. no account, no server, nothing to agree to. | 14 | 5.8 s |
| offline_4 | wordburn. it can't leak what it never sends. | 8 | 3.2 s |

**Picture:** pull the shade down and flip airplane mode on camera — a physical
action is the pattern-interrupt shape and it is the hook whether or not the
voice mentions it. Then pick a clip and let it transcribe with the aeroplane
sitting in the phone's own status bar the whole way. **Do not cut away from the
status bar while it transcribes.** That bar is the entire evidence, and a cut
reads to a suspicious viewer as the place the trick happened.

An "eighty-two megabytes" variant of `offline_2` — *"the speech model ships
inside the app, eighty-two megabytes of it, running on your own processor."* —
is worth recording as a third file. The number makes it concrete and quietly
explains the install size to anybody who goes and checks.

---

## What was kept out, and why

- **No competitor's price in the voice.** The $19.99-a-month figure came from
  third-party trackers, and TikTok's ad policy prohibits negative judgements
  about a named brand's price or features without evidence or a disclaimer.
  `../README.md` already moved the dollar figures into post copy for exactly
  this reason. Both ads make claims about Wordburn only.
- **No price of our own, either.** `displayPrice` comes from the store in the
  viewer's own currency; "fifteen ninety" is right in one country and wrong in
  the next, and a recorded file outlives a price change. Put the figure in the
  post copy, where it is a founder talking about a category and can be edited.
- **"No watermark ever" is said nowhere**, because free exports carry one.
  `payonce_2` says so out loud.
- **Nothing about languages or accents.** v1 is English-only.
- **Nothing about reliability or accuracy.** Only the A54 and clean audio have
  been tested, and the research is explicit that reliability claims backfire.
- **No store line on either close.** Both end on the name, because the Play
  listing is not live and a CTA pointing at a 404 costs more than the post
  earns. When it goes live, `payonce_4` and `offline_4` are the two lines to
  re-record, and they are last in their files on purpose.
- **"Android" is not spoken.** It is one word on screen at the close, where it
  costs no seconds.

## The open question, answered

Angle 2 of the brief asked whether the free tier has any limit besides the
watermark. It has exactly one: the **dictionary caps at 20 words** until the
unlock. Exports are unlimited and full quality — `FREE_TIER` is
`{ kind: 'watermark' }`, and the free-tier test asserts that 99 exports still do
not block — so a "no credits, no meters" ad, when you shoot it, is true of the
free app and not only the unlocked one. The dictionary cap does not need a line
in a 15-second ad, but do not write "no limits at all" in the post copy.

## Label it

The voice is synthetic, so the AI-generated-content toggle goes **on** at
upload — the same rule video 02 carries.
