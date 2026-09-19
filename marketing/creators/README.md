# Paying creators a share — and why none of it is app code

The plan is five creators at $20–$60 each, a unique code apiece, a share of what
they sell, and a rebooking of whoever moved. This file is how that is run.

## The thing to understand first

**There is nothing to build in the app, and building it would be a regression.**
An affiliate feature normally means three pieces: a code the buyer enters, a
record of which creator sent them, and a report that adds it up. On Android all
three already exist outside this app, and every one of them would be worse
inside it.

- **Attribution** is the Play Store link, not the app. A `referrer` on a Play
  URL carries `utm_source` into Play Console's acquisition report, which breaks
  installs and buyers down by that source. The creator posts a tagged link; the
  console counts it. Zero code.
- **A code the buyer redeems** is a Play Console promotion code. It is redeemed
  in the Play Store or in the billing sheet, before this app is ever asked. An
  in-app code box would be a second path to an entitlement that Play did not
  sell — which contradicts `src/policy/store.ts`'s whole premise that *Play is
  the real record* and `entitlement.json` is only the app's memory of what Play
  last said. It is also a fraud surface: codes get screenshotted.
- **The ledger** is Play Console's earnings report plus `creator-links.py`. Not
  a screen.

The two things that *could* be app code both fail on this app's own terms:

- **Play's Install Referrer API** would let the app read which creator sent the
  installer. It would then need to send that somewhere to be useful, and there
  is no server, no account and no upload — the product is that there is not one.
  The app knowing the answer and being unable to say it is a dependency and a
  privacy-policy change for nothing.
- **An in-app "creator code" that unlocks for free** would bypass billing
  entirely. That is the fraud surface above, and it gives the creator's audience
  a free app rather than giving the creator a sale to be paid for.

So the whole of the feature is: tagged links, Play promotion codes, and
arithmetic. That is what is in this directory.

## What is here

| File | What it is |
|---|---|
| `creators.csv` | Your real deals. **Not in git** — it has people's names and fees in it. Copy `creators.example.csv` to it. |
| `unlocks.csv` | Sales per creator, pasted out of Play Console. Also not in git. |
| `statements/` | Generated, one per creator per period, and the only copy of their numbers they will ever have. Not in git. |
| `../../scripts/creator-links.py` | Generates the links and the statements, and works out what each creator is owed. |

```sh
scripts/creator-links.py links
scripts/creator-links.py payout --unlocks marketing/creators/unlocks.csv \
    --net-per-unlock 5.58
```

`links` refuses to run on a duplicate handle or a duplicate promo code, because
either one is a payout sent to the wrong person.

## Setting it up, once

1. **In Play Console, create the promotion codes.** Promotions → create a
   one-time promotion against `captions_unlock_v1`. These give the unlock away
   free, so they are the creator's own copy and their audience's giveaway — they
   are *not* how the sale is attributed, because there is no sale. Check the
   current per-app quota in the console before promising anybody a batch.
2. **Generate a tagged link per creator** with `creator-links.py links`. Send
   each creator their own. This is the piece that actually pays them.
3. **Tell them both are needed.** The code in the caption is the hook; the link
   in the bio is the ledger. A creator who posts only the code produces sales
   you cannot attribute, and a share you cannot honour is worse than no share.
4. **Read the acquisition report monthly**, break down by tracked channel, and
   put the per-source buyer counts into `unlocks.csv`.

## Where the creator sees their own number

**They cannot, and no mechanism exists to let them.** Play Console's acquisition
report is yours; its user permissions are scoped to your app, not to one
`utm_source` inside it, so there is no login to hand out that shows a creator
their slice and nothing else. The affiliate platforms that do this — Impact,
PartnerStack and the rest — all assume a web checkout they sit in front of, and
this sale happens inside Google's billing sheet where nothing of ours is
present. That is the same wall as the rest of this file: the transaction is
Play's, and we see it only in a report afterwards.

So the creator sees their revenue in **a statement you send them**, which is why
the script generates one rather than leaving it to be typed:

```sh
scripts/creator-links.py statement --unlocks marketing/creators/unlocks.csv \
    --net-per-unlock 5.58 --period "September 2026" \
    --out marketing/creators/statements
```

One `.txt` per creator, or `--handle` for a single one. It shows its working —
where the unlock count came from, that it counts buyers rather than views, that
it is net of refunds, and how the per-unlock figure got from the sticker price
to what Play pays out. That is deliberate. A creator handed a bare number by
somebody who controls the only copy of the ledger has no reason to believe it,
and the ones who have been burned by an affiliate programme before will assume
the worst. Showing the derivation is the cheapest trust you can buy, and it
costs one paragraph.

**Say all of this in the outreach message, before they agree to anything.** No
live dashboard, a statement on a monthly cadence, paid within fourteen days of
it. A creator who expected a real-time panel and got an email in week five is a
creator who thinks they are being cheated, and they will say so publicly. At
$20–$60 a post, told up front, it is not usually an objection.

Two things that would make it self-serve, if the cadence ever becomes a
complaint. Neither needs app code either:

- **A shared Google Sheet**, one tab per creator, pasted into from the same
  report. They can look whenever they like; you have one more thing to keep
  current, and a tab is only as fresh as the last paste.
- **A small static page per creator** at an unguessable URL, published from the
  same generated data. Same freshness problem, better presentation, and now
  there is a web thing to host — which this project has so far managed to avoid
  entirely, and the privacy policy says so.

Start with the statement. Add a sheet only when somebody asks twice.

## The arithmetic, which is the part that bites

Pay the share on **what Play actually pays you**, not on the sticker price, and
write the deal that way. A $7.99 unlock is not $7.99 of revenue: Play takes its
service fee and tax comes out in most countries, so the number that lands is
somewhere near $5.50. A 35% share of $7.99 is $2.80; of $5.58 it is $1.95. On
forty sales that is a $34 difference, which is a creator's whole flat fee.

Run the example data and look at the bottom line:

```
total           40     223.20     78.12    60.00    138.12
net kept: 85.08 of 223.20 revenue
```

**A flat fee plus 35% keeps you under 40% of revenue at these volumes**, because
the flat fee is most of it. That is fine as customer acquisition and it is not
fine as a standing arrangement. The flat fee is what buys the post; the share is
what makes a good post worth repeating. Two shapes that survive contact:

- **Flat fee only for the first round**, then share-only on a rebooking. You pay
  for the experiment once and for performance thereafter.
- **Share-only with a floor** — no fee, a higher percentage. Costs nothing on a
  post that does nothing, which is the promise of revenue share in the first
  place, and the creators who take it are the ones who believe the product
  converts.

Decide which before the first outreach message, because renegotiating downward
after a creator's post has worked is how you lose the creator.

## What the post should be

Covered at length in `../README.md`: the finding is that native, creator-style
content beats brand films on organic TikTok, and that the top-performing hook
opens on the finished result. For this app that lines up unusually well —
**ask them to caption their normal video with Wordburn.** The captions are
visible in their own post, so the post is the demo, and "done in thirty seconds,
offline" as the closing line is a claim the video has already proved. It needs
nobody on camera who was not going to be there anyway.

## Rebooking

One round is not a measurement. The rule worth holding: a creator gets rebooked
on unlocks per post, not on views — the whole reason the link exists is that
those are different numbers, and on a paid-once app they come apart badly.
Keep the campaign column in `creators.csv` distinct per wave so the second round
is countable against the first rather than added to it.

## Before any of this can run

`captions_unlock_v1` does not exist in any Play Console, the app has never been
published, and nobody has ever bought anything — see Known issues in
`CLAUDE.md`. There are no links to hand out until the app is on a track and the
product is active, and no promotion codes either. This file is ready for that
day; it cannot be tested before it.
