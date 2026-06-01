# Supabase Realtime za živi box score / zapisnik

Klijentska aplikacija ([`hooks/use-match-scorebook-realtime.ts`](../../hooks/use-match-scorebook-realtime.ts)) se pretplaćuje na **Postgres changes**:

- **`match_events`** — `INSERT` (svaki koš / faul / event)
- **`matches`** — `UPDATE` (početak / kraj utakmice, status, rezultati)

Na promenu pozove se debounced (500 ms) RPC `get_zapisnicar_match_detail` da bi se osvežio kompletan, konzistentan Payload. Fallback polling u [`components/match-scorebook-detail-view.tsx`](../../components/match-scorebook-detail-view.tsx) ostaje kao mreža za sigurnost (30 s / 22 s / 60 s prema role + status).

---

## Šta je obavezno da bi Realtime radio

### 1) Tabele moraju biti u `supabase_realtime` publikaciji

Bez ovoga Postgres WAL **ne emituje** promene Realtime serveru i klijent nikad ne dobije event.

**Nalepi i pokreni u Supabase SQL editor-u:** [`docs/sql-patches/realtime-publications.sql`](realtime-publications.sql).

Ili kraće u Dashboard-u: **Database → Replication → `supabase_realtime`** → uključi `public.match_events` i `public.matches`.

**Verifikacija (uvek pokreni nakon patcha):**

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('matches', 'match_events')
order by tablename;
```

Očekivan rezultat — **dva reda**:

| schemaname | tablename     |
| ---------- | ------------- |
| public     | match_events  |
| public     | matches       |

### 2) RLS pravila za SELECT moraju puštati korisnika do reda

Realtime server kao klijent IZVRŠAVA `select` na promenjenom redu sa **korisničkim JWT‑om** — ako mu RLS to ne dozvoli, event se ne isporučuje tom korisniku.

- **`match_events`** — politika [`match_events_select`](../sql-klub-module.sql) već dozvoljava igračima, članovima učesnik‑klubova, zvaničnicima, savezu, adminu, delegatu lige.
- **`public.matches`** — trenutno **bez RLS** (svaki autentifikovan korisnik vidi sve mečeve). Ako se to ikada zatvori, dodaj odgovarajuću `select` policy ili će `UPDATE` event prestati da stiže gledaocima.

### 3) Klijent mora biti autentifikovan pre `.subscribe()`

`use-match-scorebook-realtime` se aktivira tek kad `MatchScorebookDetailView` ima `data` (znači RPC je već prošao kao autentifikovan korisnik), pa je ovo automatski ispunjeno.

---

## Brzi smoke test

1. Prijavi se kao **klub trener** ili **igrač** na meču A.
2. Otvori meč A → vidiš **UŽIVO · BOX SCORE** karticu (read‑only varijantu).
3. U drugom uređaju prijavi se kao **zapisnik** istog meča, klikni **+2**.
4. Na prvom uređaju, u roku od ~0.5 – 1 s skor i tabela treba da se osveže.
5. Kao **delegat** pritisni **Kraj utakmice** → svi gledaoci (uključujući zapisnika) odmah dobijaju `status = finished` i prelaze u **ZAVRŠENO · BOX SCORE**.

Ako se ništa ne dešava:

- Proveri verifikacioni `select` iz koraka 1 (tabele moraju biti u publikaciji).
- U DevTools / Flipper logu pogledaj `realtime`/`channel` poruke (`SUBSCRIBED` → ok; `CHANNEL_ERROR` → najčešće RLS ili publikacija).
- Privremeno smanji `DEBOUNCE_MS` u hooku radi dijagnostike.

---

## Alternativa: Broadcast from Database (opciono, za kasnije)

Kada baza naraste i `postgres_changes` (WAL pretplava) postane preusko grlo, prelaz na **Broadcast from Database** sa RLS‑aware kanalima je preporučen put:

1. Triger na `match_events` / `matches` koji zove `realtime.send(payload, event, 'match:'||match_id, private => true)`.
2. RLS policy nad `realtime.messages` koja dopušta čitanje topic‑a `match:{id}` istim viewer skupom kao `match_events_select`.
3. Klijent: `supabase.channel('match:'+id, { config: { private: true } }).on('broadcast', { event: 'match_event' }, handler).subscribe()`.

Za našu trenutnu skalu (jedan event ~ jedan koš) `postgres_changes` je dovoljan i jednostavniji. Promenu radimo samo ako WAL latencije postanu primetne.

Reference: [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) · [Broadcast](https://supabase.com/docs/guides/realtime/broadcast) · [Broadcast from Database](https://supabase.com/docs/guides/realtime/broadcast#broadcast-from-database).
