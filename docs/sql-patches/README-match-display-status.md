# Prikazni status utakmice — SQL patch redosled

Statusi (samo prikaz, DB ostaje `scheduled` / `live` / `finished`):

| Status | Kada |
|--------|------|
| **ZAKAZANA** | Termin još nije nastupio |
| **ISČEKIVANJE** | Termin je prošao istog dana, uslovi za početak ispunjeni, delegat nije kliknuo „Počni utakmicu” |
| **NEMA USLOVA** | Termin je prošao istog dana, uslovi nisu ispunjeni |
| **NEODIGRANA** | Prošao je kalendarski dan termina, delegat nije pokrenuo utakmicu |
| **UŽIVO** | Delegat je kliknuo „Počni utakmicu” |
| **ZAVRŠENA** | Delegat je kliknuo „Kraj utakmice” |

---

## Šta kopirati u Supabase SQL Editor (redom)

Otvori **Supabase Dashboard → SQL → New query**. Za svaki korak: nalepi **ceo fajl**, klikni **Run**, sačekaj uspeh, pa pređi na sledeći.

### Korak 1 — osnovne funkcije

Kopiraj i pokreni **ceo** sadržaj fajla:

`docs/sql-patches/match-display-status.sql`

### Korak 2 — RPC-ji (liste i detalji)

Kopiraj i pokreni **ceo** sadržaj fajla:

`docs/sql-patches/match-display-status-rpcs.sql`

### Korak 3 — kalendar delegata (liga utakmice)

Kopiraj i pokreni **ceo** sadržaj fajla:

`docs/sql-patches/delegate-league-matches-objection-marker.sql`

---

## Verifikacija (opciono)

```sql
-- helper postoji
select public.match_display_status(id)
from public.matches
order by scheduled_at desc
limit 5;

-- primer logike za scheduled meč
select public.resolve_match_display_status(
  'scheduled',
  now() - interval '2 days',
  true
);
-- očekivano: NEODIGRANA
```

---

## Napomena

- **NEODIGRANA** se računa po kalendarskom danu u vremenskoj zoni `Europe/Belgrade`.
- Ako si ranije pokrenuo staru verziju sa **ISČEKANJE**, ponovo pokreni korake 1–3 da se ažurira SQL.
