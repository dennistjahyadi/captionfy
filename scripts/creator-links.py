#!/usr/bin/env python3
"""Per-creator Play links, and what each creator is owed.

The revenue share is not a feature of the app — see marketing/creators/README.md
for why. It is a tagged Play Store link per creator, Play Console's acquisition
report as the ledger, and this script as the arithmetic.

    scripts/creator-links.py links
    scripts/creator-links.py payout --unlocks marketing/creators/unlocks.csv \
        --net-per-unlock 5.58

Both read marketing/creators/creators.csv unless --creators says otherwise.
"""

from __future__ import annotations

import argparse
import csv
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CREATORS = ROOT / "marketing" / "creators" / "creators.csv"

# Must match app.json's android.package, and the app must be published under it.
PACKAGE = "com.wordburn.app"
PLAY_URL = "https://play.google.com/store/apps/details"


@dataclass
class Creator:
    handle: str
    platform: str
    campaign: str
    fee_usd: float
    share_pct: float
    promo_code: str

    def referrer(self) -> str:
        # Play takes one referrer value, itself a URL-encoded query string.
        inner = (
            f"utm_source={self.handle}"
            f"&utm_medium={self.platform}"
            f"&utm_campaign={self.campaign}"
        )
        return quote(inner, safe="")

    def link(self) -> str:
        return f"{PLAY_URL}?id={PACKAGE}&referrer={self.referrer()}"


def read_creators(path: Path) -> list[Creator]:
    if not path.exists():
        sys.exit(f"no creator file at {path} — copy creators.example.csv to it")
    rows: list[Creator] = []
    with path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if not row.get("handle") or row["handle"].lstrip().startswith("#"):
                continue
            rows.append(
                Creator(
                    handle=row["handle"].strip(),
                    platform=row.get("platform", "creator").strip() or "creator",
                    campaign=row.get("campaign", "launch").strip() or "launch",
                    fee_usd=float(row.get("fee_usd") or 0),
                    share_pct=float(row.get("share_pct") or 0),
                    promo_code=row.get("promo_code", "").strip(),
                )
            )
    check(rows)
    return rows


def check(creators: list[Creator]) -> None:
    """A duplicate handle or code is a payout sent to the wrong person."""
    for field in ("handle", "promo_code"):
        seen: dict[str, str] = {}
        for c in creators:
            value = getattr(c, field)
            if not value:
                continue
            key = value.lower()
            if key in seen:
                sys.exit(f"duplicate {field} {value!r}: {seen[key]} and {c.handle}")
            seen[key] = c.handle
    for c in creators:
        if c.share_pct > 100 or c.share_pct < 0:
            sys.exit(f"{c.handle}: share_pct {c.share_pct} is not a percentage")
        # utm values with spaces or commas come back mangled in the console.
        if any(ch in c.handle for ch in " ,&="):
            sys.exit(f"{c.handle}: handle must be url-safe, no spaces or separators")


def cmd_links(creators: list[Creator]) -> None:
    for c in creators:
        print(f"{c.handle}  ({c.platform} · {c.campaign})")
        print(f"  link  {c.link()}")
        if c.promo_code:
            print(f"  code  {c.promo_code}")
        terms = []
        if c.fee_usd:
            terms.append(f"${c.fee_usd:,.0f} flat")
        if c.share_pct:
            terms.append(f"{c.share_pct:g}% of net per unlock")
        print(f"  deal  {' + '.join(terms) if terms else 'unset'}")
        print()
    print("utm_source is the handle — that is the column to read in Play Console.")


def read_unlocks(path: Path) -> dict[str, int]:
    if not path.exists():
        sys.exit(f"no unlocks file at {path}")
    counts: dict[str, int] = {}
    with path.open(newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            handle = (row.get("handle") or "").strip()
            if not handle or handle.startswith("#"):
                continue
            counts[handle.lower()] = counts.get(handle.lower(), 0) + int(
                row.get("unlocks") or 0
            )
    return counts


def compute(
    creators: list[Creator], unlocks_path: Path, net: float
) -> list[tuple[Creator, int, float, float]]:
    counts = read_unlocks(unlocks_path)
    known = {c.handle.lower() for c in creators}
    for handle in counts:
        if handle not in known:
            print(
                f"warning: {handle} is in the unlocks file and not in creators.csv",
                file=sys.stderr,
            )

    rows = []
    for c in creators:
        n = counts.get(c.handle.lower(), 0)
        share = n * net * c.share_pct / 100
        rows.append((c, n, share, c.fee_usd + share))
    return rows


def cmd_payout(creators: list[Creator], unlocks_path: Path, net: float) -> None:
    rows = compute(creators, unlocks_path, net)

    width = max((len(c.handle) for c, *_ in rows), default=6)
    print(f"{'creator':<{width}}  {'unlocks':>7}  {'revenue':>9}  {'share':>8}  {'fee':>7}  {'owed':>8}")
    for c, n, share, owed in rows:
        print(
            f"{c.handle:<{width}}  {n:>7}  {n * net:>9,.2f}  {share:>8,.2f}"
            f"  {c.fee_usd:>7,.2f}  {owed:>8,.2f}"
        )
    total_unlocks = sum(n for _, n, _, _ in rows)
    total_owed = sum(owed for *_, owed in rows)
    total_rev = total_unlocks * net
    print("-" * (width + 46))
    print(
        f"{'total':<{width}}  {total_unlocks:>7}  {total_rev:>9,.2f}"
        f"  {sum(s for *_, s, _ in rows):>8,.2f}"
        f"  {sum(c.fee_usd for c, *_ in rows):>7,.2f}  {total_owed:>8,.2f}"
    )
    print()
    print(f"net kept: {total_rev - total_owed:,.2f} of {total_rev:,.2f} revenue")
    print(
        "net-per-unlock is what Play actually pays you per sale, after its fee and"
        "\nafter tax — take it from the Play Console earnings report, not the sticker price."
    )


def statement_text(
    c: Creator, unlocks: int, share: float, owed: float, net: float,
    period: str, pay_within: int,
) -> str:
    """One creator's own copy. They cannot see Play Console, so this is the
    only place their number exists — which is why it shows its working."""
    label, amount = 34, 8

    def row(text: str, value: float, decimals: int = 2) -> str:
        return f"  {text:<{label}}{value:>{amount},.{decimals}f}"

    rule = "  " + " " * label + "-" * amount

    lines = [
        "Wordburn — creator statement",
        f"{c.handle} · {period}",
        "",
        row("Unlocks attributed to you", unlocks, 0),
        row("Net revenue per unlock", net),
        rule,
        row(f"Your share ({c.share_pct:g}%)", share),
    ]
    if c.fee_usd:
        lines.append(row("Flat fee", c.fee_usd))
    lines += [
        rule,
        row("Total owed", owed),
        "",
        "All figures in USD.",
        "",
        f"Where the {unlocks} comes from",
        f"  Google Play Console's acquisition report, tracked channel",
        f"  utm_source={c.handle}, for the period above. It counts buyers —",
        f"  not views, not installs — and it is net of refunds up to the day",
        f"  this was generated. Play reports on a lag of a couple of days, so",
        f"  a sale in the last 48 hours of the period lands on the next one.",
        "",
        "Where the net revenue per unlock comes from",
        f"  The unlock's sticker price less Google's service fee and sales tax,",
        f"  which is what Play actually pays out. The share is on that rather",
        f"  than on the sticker price, which is how the deal was written.",
        "",
        f"Your link  {c.link()}",
    ]
    if c.promo_code:
        lines.append(f"Your code  {c.promo_code}")
    lines += [
        "",
        f"Paid within {pay_within} days of the date on this statement. If a number",
        "looks wrong, reply with the dates and it gets re-run against the console.",
        "",
    ]
    return "\n".join(lines)


def cmd_statement(
    creators: list[Creator], unlocks_path: Path, net: float, period: str,
    out: Path | None, only: str | None, pay_within: int,
) -> None:
    rows = compute(creators, unlocks_path, net)
    if only:
        rows = [r for r in rows if r[0].handle.lower() == only.lower()]
        if not rows:
            sys.exit(f"no creator {only!r} in the creators file")
    if out:
        out.mkdir(parents=True, exist_ok=True)
    for c, n, share, owed in rows:
        text = statement_text(c, n, share, owed, net, period, pay_within)
        if out:
            slug = period.lower().replace(" ", "-")
            path = out / f"{slug}-{c.handle}.txt"
            path.write_text(text, encoding="utf-8")
            print(f"wrote {path}")
        else:
            print(text)
            print("-" * 72)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--creators", type=Path, default=DEFAULT_CREATORS)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("links", help="print a tagged Play link per creator")
    pay = sub.add_parser("payout", help="what each creator is owed")
    pay.add_argument("--unlocks", type=Path, required=True)
    pay.add_argument("--net-per-unlock", type=float, required=True)
    stmt = sub.add_parser("statement", help="one statement per creator, to send")
    stmt.add_argument("--unlocks", type=Path, required=True)
    stmt.add_argument("--net-per-unlock", type=float, required=True)
    stmt.add_argument("--period", required=True, help='e.g. "September 2026"')
    stmt.add_argument("--out", type=Path, help="directory to write .txt files into")
    stmt.add_argument("--handle", help="just this one creator")
    stmt.add_argument("--pay-within", type=int, default=14)

    args = parser.parse_args()
    creators = read_creators(args.creators)
    if args.cmd == "links":
        cmd_links(creators)
    elif args.cmd == "payout":
        cmd_payout(creators, args.unlocks, args.net_per_unlock)
    else:
        cmd_statement(
            creators, args.unlocks, args.net_per_unlock, args.period,
            args.out, args.handle, args.pay_within,
        )


if __name__ == "__main__":
    main()
