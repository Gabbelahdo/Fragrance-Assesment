"""
Suggest seed — pre-populated brands and fragrances for autocomplete.

These are the most searched/recognised brands and fragrances on the
Swedish market across designer, niche, and budget/dupe categories.

The seed is written to MongoDB once on startup (if the collection is
empty) and then used as the primary source for /fragrances/suggest.
Fragella is only called when the query produces no seed hits.
"""
from __future__ import annotations

import asyncio

import httpx
from pymongo import ReplaceOne

from app.core.config import settings
from app.core.database import get_db

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

SEED_BRANDS: list[str] = [
    # ── Designer ────────────────────────────────────────────────────────────
    "Dior", "Chanel", "Versace", "Valentino", "Burberry", "Gucci",
    "Giorgio Armani", "Armani", "Hugo Boss", "BOSS", "Calvin Klein",
    "Dolce & Gabbana", "Paco Rabanne", "Yves Saint Laurent", "YSL",
    "Tom Ford", "Givenchy", "Hermès", "Lancôme", "Ralph Lauren",
    "Lacoste", "Davidoff", "Azzaro", "Montblanc", "Viktor & Rolf",
    "Issey Miyake", "Kenzo", "Carolina Herrera", "Marc Jacobs",
    "Michael Kors", "Coach", "Jimmy Choo", "Prada", "Bvlgari", "Bulgari",
    "Cartier", "Salvatore Ferragamo", "Roberto Cavalli", "Diesel",
    "Joop!", "Narciso Rodriguez", "Estée Lauder", "Elizabeth Arden",
    "Chloé", "Nina Ricci", "Thierry Mugler", "Mugler",
    "Hollister", "Abercrombie & Fitch",
    # ── Niche ───────────────────────────────────────────────────────────────
    "Creed", "Maison Margiela", "Byredo", "Le Labo", "Diptyque",
    "Jo Malone", "Maison Francis Kurkdjian", "MFK",
    "Parfums de Marly", "Mancera", "Montale", "Serge Lutens",
    "Initio", "Xerjoff", "Nishane", "Memo Paris", "Roja Parfums",
    "Amouage", "Penhaligon's", "Acqua di Parma",
    "Nasomatto", "Orto Parisi", "Juliette Has a Gun",
    "Vilhelm Parfumerie", "Etat Libre d'Orange", "Comme des Garçons",
    # ── Budget / Dupe ────────────────────────────────────────────────────────
    "Afnan", "Lattafa", "Al Haramain", "Armaf", "Rasasi",
    "Ard al Zaafaran", "Fragrance World",
    "Victoria's Secret", "Zara", "Massimo Dutti", "Oriflame", "Avon",
]

# Each fragrance: {name, brand}  — name is the official fragrance name.
SEED_FRAGRANCES: list[dict] = [
    # ── Men's designer ───────────────────────────────────────────────────────
    {"name": "Sauvage",                     "brand": "Dior"},
    {"name": "Sauvage Elixir",              "brand": "Dior"},
    {"name": "Fahrenheit",                  "brand": "Dior"},
    {"name": "Dior Homme Intense",          "brand": "Dior"},
    {"name": "Bleu de Chanel",              "brand": "Chanel"},
    {"name": "Allure Homme Sport",          "brand": "Chanel"},
    {"name": "Allure Homme Edition Blanche","brand": "Chanel"},
    {"name": "Eros",                        "brand": "Versace"},
    {"name": "Eros Flame",                  "brand": "Versace"},
    {"name": "Dylan Blue",                  "brand": "Versace"},
    {"name": "Pour Homme",                  "brand": "Versace"},
    {"name": "1 Million",                   "brand": "Paco Rabanne"},
    {"name": "1 Million Lucky",             "brand": "Paco Rabanne"},
    {"name": "Invictus",                    "brand": "Paco Rabanne"},
    {"name": "Invictus Aqua",               "brand": "Paco Rabanne"},
    {"name": "Invictus Victory",            "brand": "Paco Rabanne"},
    {"name": "Acqua di Giò",               "brand": "Giorgio Armani"},
    {"name": "Acqua di Giò Profumo",       "brand": "Giorgio Armani"},
    {"name": "Acqua di Giò Profondo",      "brand": "Giorgio Armani"},
    {"name": "Armani Code",                "brand": "Giorgio Armani"},
    {"name": "Armani Code Absolu",         "brand": "Giorgio Armani"},
    {"name": "Boss Bottled",               "brand": "Hugo Boss"},
    {"name": "Boss Bottled Night",         "brand": "Hugo Boss"},
    {"name": "The Scent",                  "brand": "Hugo Boss"},
    {"name": "The Scent Intense",          "brand": "Hugo Boss"},
    {"name": "La Nuit de l'Homme",         "brand": "Yves Saint Laurent"},
    {"name": "Y",                           "brand": "Yves Saint Laurent"},
    {"name": "L'Homme",                    "brand": "Yves Saint Laurent"},
    {"name": "Kouros",                     "brand": "Yves Saint Laurent"},
    {"name": "Legend",                     "brand": "Montblanc"},
    {"name": "Explorer",                   "brand": "Montblanc"},
    {"name": "Explorer Ultra Blue",        "brand": "Montblanc"},
    {"name": "Starwalker",                 "brand": "Montblanc"},
    {"name": "L'Homme Lacoste",            "brand": "Lacoste"},
    {"name": "Cool Water",                 "brand": "Davidoff"},
    {"name": "Chrome",                     "brand": "Azzaro"},
    {"name": "Azzaro Wanted",              "brand": "Azzaro"},
    {"name": "Azzaro Wanted by Night",     "brand": "Azzaro"},
    {"name": "L'Eau d'Issey pour Homme",   "brand": "Issey Miyake"},
    {"name": "CK One",                     "brand": "Calvin Klein"},
    {"name": "Eternity for Men",           "brand": "Calvin Klein"},
    {"name": "Obsession for Men",          "brand": "Calvin Klein"},
    {"name": "The One for Men",            "brand": "Dolce & Gabbana"},
    {"name": "Light Blue pour Homme",      "brand": "Dolce & Gabbana"},
    {"name": "Guilty pour Homme",          "brand": "Gucci"},
    {"name": "Guilty Absolute",            "brand": "Gucci"},
    {"name": "Polo Blue",                  "brand": "Ralph Lauren"},
    {"name": "Polo Black",                 "brand": "Ralph Lauren"},
    {"name": "Polo Red",                   "brand": "Ralph Lauren"},
    {"name": "Mr. Burberry",               "brand": "Burberry"},
    {"name": "Burberry Touch for Men",     "brand": "Burberry"},
    {"name": "Déclaration",               "brand": "Cartier"},
    {"name": "Givenchy Gentleman",         "brand": "Givenchy"},
    {"name": "Pi",                         "brand": "Givenchy"},
    {"name": "L'Homme Prada",             "brand": "Prada"},
    {"name": "Luna Rossa",                 "brand": "Prada"},
    {"name": "Luna Rossa Carbon",          "brand": "Prada"},
    {"name": "Spicebomb",                  "brand": "Viktor & Rolf"},
    {"name": "Spicebomb Extreme",          "brand": "Viktor & Rolf"},
    {"name": "Uomo",                       "brand": "Valentino"},
    {"name": "Uomo Intense",               "brand": "Valentino"},
    {"name": "Joop! Homme",               "brand": "Joop!"},
    {"name": "Only The Brave",             "brand": "Diesel"},
    {"name": "Spirit of the Brave",        "brand": "Diesel"},
    # ── Women's designer ─────────────────────────────────────────────────────
    {"name": "No. 5",                      "brand": "Chanel"},
    {"name": "Coco Mademoiselle",          "brand": "Chanel"},
    {"name": "Chance",                     "brand": "Chanel"},
    {"name": "Chance Eau Tendre",          "brand": "Chanel"},
    {"name": "Gabrielle",                  "brand": "Chanel"},
    {"name": "Miss Dior",                  "brand": "Dior"},
    {"name": "Miss Dior Rose N'Roses",     "brand": "Dior"},
    {"name": "J'adore",                   "brand": "Dior"},
    {"name": "Hypnotic Poison",            "brand": "Dior"},
    {"name": "Black Opium",               "brand": "Yves Saint Laurent"},
    {"name": "Libre",                      "brand": "Yves Saint Laurent"},
    {"name": "Mon Paris",                  "brand": "Yves Saint Laurent"},
    {"name": "Opium",                      "brand": "Yves Saint Laurent"},
    {"name": "Valentina",                  "brand": "Valentino"},
    {"name": "Donna Born in Roma",         "brand": "Valentino"},
    {"name": "La Vie Est Belle",          "brand": "Lancôme"},
    {"name": "La Vie Est Belle en Rose",  "brand": "Lancôme"},
    {"name": "Idôle",                     "brand": "Lancôme"},
    {"name": "Trésor",                    "brand": "Lancôme"},
    {"name": "Flowerbomb",                 "brand": "Viktor & Rolf"},
    {"name": "Flowerbomb Nectar",          "brand": "Viktor & Rolf"},
    {"name": "Good Girl",                  "brand": "Carolina Herrera"},
    {"name": "Good Girl Dot Drama",        "brand": "Carolina Herrera"},
    {"name": "212 VIP",                    "brand": "Carolina Herrera"},
    {"name": "Angel",                      "brand": "Mugler"},
    {"name": "Alien",                      "brand": "Mugler"},
    {"name": "Alien Goddess",              "brand": "Mugler"},
    {"name": "Aura",                       "brand": "Mugler"},
    {"name": "Si",                         "brand": "Giorgio Armani"},
    {"name": "Si Intense",                 "brand": "Giorgio Armani"},
    {"name": "Si Passione",                "brand": "Giorgio Armani"},
    {"name": "Bright Crystal",             "brand": "Versace"},
    {"name": "Crystal Noir",               "brand": "Versace"},
    {"name": "Versense",                   "brand": "Versace"},
    {"name": "Eros pour Femme",           "brand": "Versace"},
    {"name": "Lady Million",               "brand": "Paco Rabanne"},
    {"name": "Lady Million Lucky",         "brand": "Paco Rabanne"},
    {"name": "Olympea",                    "brand": "Paco Rabanne"},
    {"name": "Olympea Legend",             "brand": "Paco Rabanne"},
    {"name": "Bloom",                      "brand": "Gucci"},
    {"name": "Bloom Profumo di Fiori",     "brand": "Gucci"},
    {"name": "Flora Gorgeous Gardenia",    "brand": "Gucci"},
    {"name": "Daisy",                      "brand": "Marc Jacobs"},
    {"name": "Daisy Love",                 "brand": "Marc Jacobs"},
    {"name": "Dot",                        "brand": "Marc Jacobs"},
    {"name": "Jimmy Choo Eau de Parfum",   "brand": "Jimmy Choo"},
    {"name": "Illicit",                    "brand": "Jimmy Choo"},
    {"name": "Fever",                      "brand": "Jimmy Choo"},
    {"name": "Dreams",                     "brand": "Coach"},
    {"name": "Dreams Sunset",             "brand": "Coach"},
    {"name": "Chloé Eau de Parfum",       "brand": "Chloé"},
    {"name": "Nomade",                     "brand": "Chloé"},
    {"name": "For Her",                    "brand": "Narciso Rodriguez"},
    {"name": "Musc Noir Rose",             "brand": "Narciso Rodriguez"},
    {"name": "Euphoria",                   "brand": "Calvin Klein"},
    {"name": "Eternity for Women",         "brand": "Calvin Klein"},
    {"name": "Light Blue Women",           "brand": "Dolce & Gabbana"},
    {"name": "The One for Women",          "brand": "Dolce & Gabbana"},
    {"name": "Ange ou Démon",             "brand": "Givenchy"},
    {"name": "Irresistible",              "brand": "Givenchy"},
    {"name": "L'Interdit",               "brand": "Givenchy"},
    {"name": "Her",                        "brand": "Burberry"},
    {"name": "Brit for Her",              "brand": "Burberry"},
    {"name": "Beautiful",                  "brand": "Estée Lauder"},
    {"name": "Pleasures",                  "brand": "Estée Lauder"},
    {"name": "Modern Muse",               "brand": "Estée Lauder"},
    {"name": "White Tea",                  "brand": "Elizabeth Arden"},
    {"name": "Sunflowers",                 "brand": "Elizabeth Arden"},
    {"name": "Green Tea",                  "brand": "Elizabeth Arden"},
    {"name": "L'Air du Temps",            "brand": "Nina Ricci"},
    {"name": "Sexy Amber",                "brand": "Michael Kors"},
    {"name": "Midnight Shimmer",          "brand": "Michael Kors"},
    {"name": "Tendre Poison",             "brand": "Dior"},
    {"name": "Pure Poison",               "brand": "Dior"},
    # ── Unisex / niche ───────────────────────────────────────────────────────
    {"name": "Aventus",                    "brand": "Creed"},
    {"name": "Green Irish Tweed",          "brand": "Creed"},
    {"name": "Silver Mountain Water",      "brand": "Creed"},
    {"name": "Millesime Imperial",         "brand": "Creed"},
    {"name": "Virgin Island Water",        "brand": "Creed"},
    {"name": "Baccarat Rouge 540",         "brand": "Maison Francis Kurkdjian"},
    {"name": "Oud Satin Mood",             "brand": "Maison Francis Kurkdjian"},
    {"name": "Aqua Universalis",           "brand": "Maison Francis Kurkdjian"},
    {"name": "Grand Soir",                 "brand": "Maison Francis Kurkdjian"},
    {"name": "À la Rose",                 "brand": "Maison Francis Kurkdjian"},
    {"name": "Gypsy Water",               "brand": "Byredo"},
    {"name": "Bal d'Afrique",             "brand": "Byredo"},
    {"name": "Mojave Ghost",              "brand": "Byredo"},
    {"name": "Bibliothèque",             "brand": "Byredo"},
    {"name": "Blanche",                   "brand": "Byredo"},
    {"name": "Sundazed",                  "brand": "Byredo"},
    {"name": "Santal 33",                 "brand": "Le Labo"},
    {"name": "Rose 31",                   "brand": "Le Labo"},
    {"name": "Another 13",               "brand": "Le Labo"},
    {"name": "Bergamote 22",              "brand": "Le Labo"},
    {"name": "Noir 29",                   "brand": "Le Labo"},
    {"name": "Philosykos",               "brand": "Diptyque"},
    {"name": "Do Son",                   "brand": "Diptyque"},
    {"name": "Tam Dao",                  "brand": "Diptyque"},
    {"name": "Eau Rose",                 "brand": "Diptyque"},
    {"name": "Baies",                    "brand": "Diptyque"},
    {"name": "L'Ombre dans l'Eau",      "brand": "Diptyque"},
    {"name": "Wood Sage & Sea Salt",     "brand": "Jo Malone"},
    {"name": "Lime Basil & Mandarin",    "brand": "Jo Malone"},
    {"name": "Peony & Blush Suede",      "brand": "Jo Malone"},
    {"name": "English Pear & Freesia",   "brand": "Jo Malone"},
    {"name": "Pomelo & Red Berry",       "brand": "Jo Malone"},
    {"name": "Layton",                   "brand": "Parfums de Marly"},
    {"name": "Pegasus",                  "brand": "Parfums de Marly"},
    {"name": "Herod",                    "brand": "Parfums de Marly"},
    {"name": "Althair",                  "brand": "Parfums de Marly"},
    {"name": "Delina",                   "brand": "Parfums de Marly"},
    {"name": "Greenley",                 "brand": "Parfums de Marly"},
    {"name": "Cedrat Boise",             "brand": "Mancera"},
    {"name": "Rose Vanille",             "brand": "Mancera"},
    {"name": "Aoud Exclusif",            "brand": "Mancera"},
    {"name": "Instant Crush",            "brand": "Mancera"},
    {"name": "Black Aoud",               "brand": "Montale"},
    {"name": "Roses Musk",               "brand": "Montale"},
    {"name": "Intense Café",             "brand": "Montale"},
    {"name": "Oud Dreams",               "brand": "Montale"},
    {"name": "Honey Aoud",               "brand": "Montale"},
    {"name": "Jazz Club",                "brand": "Maison Margiela"},
    {"name": "By the Fireplace",         "brand": "Maison Margiela"},
    {"name": "Flower Market",            "brand": "Maison Margiela"},
    {"name": "Beach Walk",               "brand": "Maison Margiela"},
    {"name": "On a Date",                "brand": "Maison Margiela"},
    {"name": "Black Orchid",             "brand": "Tom Ford"},
    {"name": "Lost Cherry",              "brand": "Tom Ford"},
    {"name": "Oud Wood",                 "brand": "Tom Ford"},
    {"name": "Tobacco Vanille",          "brand": "Tom Ford"},
    {"name": "Neroli Portofino",         "brand": "Tom Ford"},
    {"name": "Soleil Blanc",             "brand": "Tom Ford"},
    {"name": "Noir de Noir",             "brand": "Tom Ford"},
    {"name": "Colonia",                  "brand": "Acqua di Parma"},
    {"name": "Colonia Intensa",          "brand": "Acqua di Parma"},
    {"name": "Blu Mediterraneo",         "brand": "Acqua di Parma"},
    {"name": "Halfeti",                  "brand": "Penhaligon's"},
    {"name": "Juniper Sling",            "brand": "Penhaligon's"},
    {"name": "Naxos",                    "brand": "Xerjoff"},
    {"name": "Erba Pura",                "brand": "Xerjoff"},
    {"name": "Hacivat",                  "brand": "Nishane"},
    {"name": "Fan Your Flames",          "brand": "Nishane"},
    {"name": "Black Afgano",             "brand": "Nasomatto"},
    {"name": "Duro",                     "brand": "Nasomatto"},
    {"name": "Oud for Greatness",        "brand": "Initio"},
    {"name": "Absolute Aphrodisiac",     "brand": "Initio"},
    {"name": "Reflection Man",           "brand": "Amouage"},
    {"name": "Interlude Man",            "brand": "Amouage"},
    {"name": "Jubilation XXV",           "brand": "Amouage"},
    {"name": "Elysium",                  "brand": "Roja Parfums"},
    {"name": "Enigma",                   "brand": "Roja Parfums"},
    {"name": "Not a Perfume",            "brand": "Juliette Has a Gun"},
    {"name": "Casbah",                   "brand": "Memo Paris"},
    {"name": "A Quietude",               "brand": "Vilhelm Parfumerie"},
    # ── Budget / Dupe ────────────────────────────────────────────────────────
    {"name": "9PM",                      "brand": "Afnan"},
    {"name": "Supremacy Blue",           "brand": "Afnan"},
    {"name": "Supremacy Silver",         "brand": "Afnan"},
    {"name": "Supremacy Noir",           "brand": "Afnan"},
    {"name": "Khamrah",                  "brand": "Lattafa"},
    {"name": "Oud Mood",                 "brand": "Lattafa"},
    {"name": "Raghba",                   "brand": "Lattafa"},
    {"name": "Yara",                     "brand": "Lattafa"},
    {"name": "Asad",                     "brand": "Lattafa"},
    {"name": "Amber Oud",                "brand": "Al Haramain"},
    {"name": "Amber Oud Gold Edition",   "brand": "Al Haramain"},
    {"name": "Club de Nuit Intense Man", "brand": "Armaf"},
    {"name": "Club de Nuit Women",       "brand": "Armaf"},
    {"name": "Tres Nuit",               "brand": "Armaf"},
    {"name": "La Yuqawam",              "brand": "Rasasi"},
    {"name": "Hawas",                   "brand": "Rasasi"},
    {"name": "Bombshell",               "brand": "Victoria's Secret"},
    {"name": "Pure Seduction",          "brand": "Victoria's Secret"},
    {"name": "Velvet Petals",           "brand": "Victoria's Secret"},
    {"name": "Rich Warm Addictive",     "brand": "Zara"},
    {"name": "Femme",                   "brand": "Zara"},
    {"name": "Night Pour Homme",        "brand": "Zara"},
]


# ---------------------------------------------------------------------------
# Seeding helper
# ---------------------------------------------------------------------------

async def ensure_suggest_seed() -> None:
    """
    Populate the suggest_seed collection if it is empty.
    Safe to call on every startup — is a no-op when data already exists.
    Inserts in small batches to avoid Cosmos DB RU limits.
    """
    try:
        db  = get_db()
        col = db["suggest_seed"]

        count = await col.count_documents({})
        if count > 0:
            print(f"[fragrances.seed] suggest_seed already has {count} docs — skipping seed.")
            return

        docs: list[dict] = []

        for brand_name in SEED_BRANDS:
            docs.append({
                "_id":        f"brand:{brand_name.lower()}",
                "type":       "brand",
                "name":       brand_name,
                "name_lower": brand_name.lower(),
            })

        for frag in SEED_FRAGRANCES:
            slug = f"{frag['name'].lower()}|{frag['brand'].lower()}"
            docs.append({
                "_id":         f"frag:{slug}",
                "type":        "fragrance",
                "name":        frag["name"],
                "brand":       frag["brand"],
                "name_lower":  frag["name"].lower(),
                "brand_lower": frag["brand"].lower(),
            })

        # Insert in batches of 20 to stay within Cosmos DB RU limits
        BATCH = 20
        inserted = 0
        for start in range(0, len(docs), BATCH):
            batch = docs[start : start + BATCH]
            try:
                await col.insert_many(batch, ordered=False)
                inserted += len(batch)
            except Exception as batch_exc:
                print(f"[fragrances.seed] Batch {start}–{start+len(batch)} error: {batch_exc}")

        print(f"[fragrances.seed] Seeded {inserted}/{len(docs)} suggest documents "
              f"({len(SEED_BRANDS)} brands, {len(SEED_FRAGRANCES)} fragrances).")

    except Exception as exc:
        print(f"[fragrances.seed] Seed error: {exc}")


async def fragella_bulk_seed() -> dict:
    """
    Bulk-populate suggest_seed by sweeping Fragella A–Z (26 API calls).

    For each letter we request up to 200 fragrances whose name starts with
    that letter.  Brands are extracted from the results — no separate calls.
    All documents are upserted so the collection never loses existing data.

    Returns a summary dict with counts.
    """
    url     = f"{settings.fragrance_api_url}/v1/fragrances"
    headers = {"x-api-key": settings.fragrance_api_key}
    col     = get_db()["suggest_seed"]

    total_frags  = 0
    total_brands = 0
    seen_brands: set[str] = set()

    async with httpx.AsyncClient(timeout=15.0) as client:
        for letter in "abcdefghijklmnopqrstuvwxyz":
            try:
                resp = await client.get(
                    url,
                    params={"search": letter, "limit": 200},
                    headers=headers,
                )
                resp.raise_for_status()
                data: list[dict] = resp.json()
            except Exception as exc:
                print(f"[fragrances.seed] Fragella sweep '{letter}' failed: {exc}")
                await asyncio.sleep(0.5)
                continue

            ops: list[ReplaceOne] = []

            for item in data:
                name  = (item.get("Name")  or "").strip()
                brand = (item.get("Brand") or "").strip()
                if not name:
                    continue

                # Fragrance document
                frag_id = f"frag:{name.lower()}|{brand.lower()}"
                ops.append(ReplaceOne(
                    {"_id": frag_id},
                    {
                        "_id":         frag_id,
                        "type":        "fragrance",
                        "name":        name,
                        "brand":       brand,
                        "name_lower":  name.lower(),
                        "brand_lower": brand.lower(),
                    },
                    upsert=True,
                ))
                total_frags += 1

                # Brand document (once per unique brand)
                b_lower = brand.lower()
                if brand and b_lower not in seen_brands:
                    seen_brands.add(b_lower)
                    brand_id = f"brand:{b_lower}"
                    ops.append(ReplaceOne(
                        {"_id": brand_id},
                        {
                            "_id":        brand_id,
                            "type":       "brand",
                            "name":       brand,
                            "name_lower": b_lower,
                        },
                        upsert=True,
                    ))
                    total_brands += 1

            # Bulk-write in batches of 50 to respect Cosmos DB RU limits
            BATCH = 50
            for start in range(0, len(ops), BATCH):
                try:
                    await col.bulk_write(ops[start : start + BATCH], ordered=False)
                except Exception as exc:
                    print(f"[fragrances.seed] bulk_write error (letter={letter}): {exc}")

            print(f"[fragrances.seed] '{letter}': {len(data)} fragrances fetched.")

            # Small pause between letters to be kind to the Fragella API
            await asyncio.sleep(0.3)

    final_count = await col.count_documents({})
    print(
        f"[fragrances.seed] Bulk seed complete — "
        f"{total_frags} fragrances, {total_brands} brands, "
        f"{final_count} total docs in collection."
    )
    return {
        "fragrances_fetched": total_frags,
        "brands_fetched":     total_brands,
        "total_in_collection": final_count,
    }
