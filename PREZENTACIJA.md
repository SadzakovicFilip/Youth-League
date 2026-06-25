# KLS — Košarkaška Liga Srbije (digitalna platforma za vođenje lige)

> **Jedna rečenica:** Aplikacija koja celu ligu mlađih kategorija prebacuje sa papira na telefon — od zakazivanja utakmice, preko elektronskog zapisnika uživo, do automatske tabele i **objektivne statistike svakog igrača** — i tako prvi put daje realnu sliku kvaliteta mladih košarkaša na osnovu onoga što urade na terenu, a ne na osnovu toga ko stoji iza njih.

---

## Sadržaj

1. [Zašto ovo postoji — problem koji rešavamo](#1-zašto-ovo-postoji--problem-koji-rešavamo)
2. [Kako funkcioniše aplikacija](#2-kako-funkcioniše-aplikacija)
3. [Hijerarhija i pristup — niko se ne registruje sam](#3-hijerarhija-i-pristup--niko-se-ne-registruje-sam)
4. [Prednosti aplikacije](#4-prednosti-aplikacije)
5. [Šta aplikacija olakšava (po ulogama)](#5-šta-aplikacija-olakšava-po-ulogama)
6. [Fokus: šta dobija DELEGAT](#6-fokus-šta-dobija-delegat)
7. [Strateška vrednost za srpsku košarku](#7-strateška-vrednost-za-srpsku-košarku)
8. [Kome se obraćamo i kojim redom (savez → delegat → klubovi)](#8-kome-se-obraćamo-i-kojim-redom)
9. [Kako uživo prezentovati — scenario sa 7 telefona](#9-kako-uživo-prezentovati--scenario-sa-7-telefona)
10. [Redosled prezentacije korak po korak](#10-redosled-prezentacije-korak-po-korak)
11. [Anticipirana pitanja i odgovori](#11-anticipirana-pitanja-i-odgovori)
12. [Tehnička osnova (ukratko)](#12-tehnička-osnova-ukratko)

---

## 1. Zašto ovo postoji — problem koji rešavamo

Danas se liga mlađih kategorija vodi **na papiru**. To znači:

- **Zapisnik utakmice** se piše ručno, čuva se kao papir, lako se izgubi, teško se proverava i gotovo je nemoguće brzo pretražiti.
- **Rezultati i tabele** se prekucavaju ručno, kasne, i podložni su greškama.
- **Statistika igrača praktično ne postoji** na nivou cele lige. Ako i postoji, razbacana je po sveskama trenera i klubova.
- **Najveći problem:** kvalitet mladog igrača se procenjuje **subjektivno**. Ko će biti zapažen, pozvan u reprezentativne selekcije ili dobiti priliku, prečesto zavisi od toga **koliko su roditelji uticajni ili imućni**, a ne od toga **šta dete stvarno pokazuje na terenu**.

Posledica je poznata svima u košarci: **talenti se gube**, a selekcija nije zasnovana na rezultatu.

**Ova aplikacija menja upravo to.** Svaki poen, svaka trojka, svaki faul beleži se digitalno, sa vremenom i autorom upisa. Iz tih podataka se **automatski** računaju tabele, lista strelaca i kompletna statistika svakog igrača — kroz sezonu i kroz celu karijeru. Po prvi put, **brojevi govore umesto veza**.

---

## 2. Kako funkcioniše aplikacija

Aplikacija je organizovana oko **uloga (rola)**. Svako u sistemu — od saveza do igrača — vidi tačno ono što mu treba za njegov posao, i ništa više. Postoji **8 ključnih uloga**:

| Uloga | Šta radi u sistemu |
|-------|--------------------|
| **Savez** | Postavlja celu strukturu takmičenja: regije → lige → grupe → klubovi. Zakazuje utakmice. Kreira delegate, klubove, sudije. |
| **Delegat** | Operativni koordinator lige na terenu. Vidi raspored, dodeljuje sudije, **pokreće i završava** utakmicu, rešava prigovore. |
| **Klub** | Upravlja svojim članovima (igrači, treneri, zapisničari), članarinama i dodeljuje zapisničara na svoje domaće utakmice. |
| **Trener** | Vodi treninge i taktike, evidentira prisustvo, prijavljuje sastav za utakmicu, može uložiti prigovor na zapisnik. |
| **Igrač** | Vidi svoje treninge, taktike, utakmice, članarine i — najvažnije — **svoju statistiku** (sezona i karijera). |
| **Zapisničar** | Vodi **elektronski zapisnik uživo**: +1 / +2 / +3 / faul, sa funkcijom poništavanja (UNDO). |
| **Sudija** | Vidi svoje dodeljene utakmice i digitalnu licencu. |
| **Admin** | Tehnička uloga: kreira naloge na vrhu lanca (npr. savez). |

### Životni ciklus jedne utakmice (srce sistema)

Cela poenta aplikacije najbolje se vidi kroz tok jedne utakmice. Svaka uloga ima tačno definisanu odgovornost, i sistem **ne dozvoljava da se preskoči korak**:

```
1. SAVEZ zakazuje utakmicu          → utakmica se pojavljuje u rasporedu svih
2. KLUB (domaćin) dodeljuje          → bira ko će voditi zapisnik
   zapisničara
3. TRENER oba kluba prijavljuje      → sastav 5–12 igrača sa brojevima dresova
   sastav
4. DELEGAT dodeljuje 2 sudije        → bira iz baze sudija svoje lige
5. DELEGAT proverava USLOVE          → sistem automatski proverava:
                                        ✓ oba sastava (5–12 igrača)
                                        ✓ tačno 2 sudije
                                        ✓ 1 zapisničar
                                        ✓ vreme početka je stiglo
6. DELEGAT pritiska POČNI UTAKMICU   → tek kad su SVI uslovi ispunjeni
7. ZAPISNIČAR vodi zapisnik uživo    → +1/+2/+3/faul po igraču, UNDO
   (delegat prati, svi gledaju
    rezultat u realnom vremenu)
8. DELEGAT pritiska KRAJ UTAKMICE    → finalni rezultat se zaključava
9. TRENER (opciono) ulaže prigovor   → u kratkom roku posle meča
10. DELEGAT rešava prigovor          → USVOJI ili ODBIJ
```

Ključno: dugme **„Počni utakmicu" je zaključano** dok svi uslovi nisu ispunjeni. Sistem ne dozvoljava da utakmica počne bez sastava, sudija, zapisničara i pravog termina. Time se eliminišu improvizacije i naknadne „ispravke na papiru".

### Šta se dešava sa podacima (zašto je ovo moćno)

Kada zapisničar upiše koš, taj događaj **nije samo broj na ekranu** — to je trajni zapis u bazi. Iz tih pojedinačnih događaja aplikacija **automatski** gradi:

- **Rezultat utakmice** uživo (zbir svih poena),
- **Box score** (tabela učinka svakog igrača: poeni, koliko iz slobodnih bacanja, dvojki, trojki, broj faulova),
- **Tabelu lige** (pobeda = 2 boda, poraz = 1 bod, koš-razlika),
- **Listu najboljih strelaca** grupe i lige,
- **Statistiku svakog igrača** — prosek poena, ukupni učinak, raspodela načina postizanja koševa, broj odigranih utakmica, sve sumirano za **sezonu i za celu karijeru**.

Sve to — **bez ijednog dodatnog prekucavanja**. Jedan unos (zapisničar na utakmici) hrani ceo sistem.

### Sve se vidi u realnom vremenu

Dok zapisničar vodi utakmicu, **trener, igrač, klub i delegat vide rezultat kako se menja uživo** — bez osvežavanja, automatski. Roditelj koji nije mogao da dođe na utakmicu može da prati rezultat. Klub vidi kako mu tim igra. Sve je sinhronizovano.

---

## 3. Hijerarhija i pristup — niko se ne registruje sam

Ovo je jedna od najvažnijih bezbednosnih i organizacionih osobina sistema, i treba je posebno naglasiti delegatu i savezu.

**U aplikaciji ne postoji „Registruj se".** Ne postoji javni formular gde bilo ko može da napravi nalog. Postoji **samo ekran za prijavu** (korisničko ime + lozinka).

**Nalog ti može napraviti isključivo neko ko je hijerarhijski iznad tebe.** Niko ne može sam sebi da da pristup, niti da sebi dodeli ulogu. Lanac je strogo kontrolisan:

```
                        ADMIN (tehnički vrh)
                          │
                          ▼
                        SAVEZ
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
     DELEGAT           KLUB (nalog)        SUDIJA
        │                 │
        ▼                 ▼
     SUDIJA          ┌────┼────┐
   (svoje lige)      ▼    ▼    ▼
                  IGRAČ TRENER ZAPISNIČAR
```

Konkretno:

- **Savez** kreira: delegate, klubove (i njihov nalog), sudije, a po potrebi i trenere/zapisničare.
- **Delegat** kreira: sudije za **svoju ligu** (i dodeljuje im digitalnu licencu).
- **Klub** kreira: svoje igrače, trenere i zapisničare — i oni se automatski vezuju za taj klub.
- **Igrač** ne kreira nikoga — on je krajnji korisnik koji prati svoje podatke.

Svaki nalog „pamti ko ga je kreirao". Savez, na primer, vidi tačno listu korisnika koje je **on** napravio.

**Zašto je ovo važno za pitch:**

1. **Kontrola i odgovornost** — nema lažnih naloga, nema „upada sa strane". Svako u sistemu je tu zato što ga je ovlašćena osoba unela.
2. **Integritet podataka** — pošto se pristup dodeljuje odozgo, savez i delegat uvek znaju ko ima koja prava i ko je odgovoran za koji unos.
3. **Poverenje u statistiku** — pošto zapisnik vode samo ovlašćeni zapisničari koje je dodelio klub, a utakmicu otvara i zaključava delegat, **brojevima se može verovati**. To je temelj cele ideje o objektivnoj selekciji.

---

## 4. Prednosti aplikacije

### Za ceo sistem

- **Potpuna digitalizacija** — papir nestaje. Zapisnik, raspored, rezultati, tabele i statistika žive na jednom mestu, dostupni odmah i svima kojima trebaju.
- **Jedan izvor istine** — nema više različitih verzija rezultata po sveskama. Postoji jedan zvanični, digitalni zapis.
- **Objektivnost** — učinak igrača se meri onim što se desilo na terenu, a ne procenom „iz hodnika".
- **Brzina** — tabela i lista strelaca se ažuriraju **istog trenutka** kad se utakmica završi. Nema čekanja da neko prekuca rezultate.
- **Trajnost i pretraživost** — podaci ostaju zauvek. Možeš da pogledaš kako je igrač napredovao kroz tri sezone u par sekundi.
- **Transparentnost** — svi vide isto: isti raspored, isti rezultat, istu tabelu.
- **Kontrola pristupa** — strogo hijerarhijsko kreiranje naloga (vidi sekciju 3).

### Konkretne, opipljive prednosti

- Roditelj može da prati rezultat uživo, čak i kad nije na utakmici.
- Trener dobija statistiku svojih igrača bez ručnog vođenja evidencije.
- Klub ima sve svoje članove, članarine i licence na jednom mestu.
- Delegat vodi celu ligu sa telefona, bez papira i bez gomile poziva.
- Savez ima uvid u celu zemlju — sve regije, lige, grupe, klubove i rezultate — iz jedne aplikacije.

---

## 5. Šta aplikacija olakšava (po ulogama)

### Savez
- Postavlja celu piramidu takmičenja (regije → lige → grupe → klubovi) iz aplikacije.
- Zakazuje utakmice centralno; svi odmah vide raspored.
- Kreira delegate, klubove i sudije — i prati ko je koga kreirao.
- Ima pregled tabela, strelaca i rezultata **cele zemlje** na jednom mestu.

### Delegat
- *(Detaljno u sekciji 6 — ovo je naš ključni sagovornik.)*

### Klub
- Sve članove (igrače, trenere, zapisničare) drži evidentirane na jednom mestu.
- Vodi **članarine** digitalno — ko je platio, ko duguje, kolika je mesečna članarina.
- Dodeljuje zapisničara na svoje domaće utakmice.
- Prati učinak svojih igrača i poziciju kluba u ligi.

### Trener
- Zakazuje treninge i evidentira **prisustvo** igrača.
- Vodi **taktike** (napadi/odbrane) digitalno i deli ih sa igračima.
- Prijavljuje **sastav** za utakmicu (brojevi dresova, 5–12 igrača).
- Vidi statistiku svojih igrača — ko koliko daje, kako postiže koševe, prisustvo na treninzima.
- Može uložiti **prigovor na zapisnik** ako smatra da nešto nije u redu.

### Igrač
- Vidi svoje treninge i da li je evidentiran kao prisutan.
- Pristupa taktikama tima.
- Prati svoje utakmice i status članarine.
- **Vidi svoju statistiku** — poene, prosek, raspodelu koševa, sezonu i karijeru. Ovo je ono što ga motiviše i što ga čini „vidljivim" na osnovu rezultata.

### Zapisničar
- Vodi **elektronski zapisnik uživo** umesto papira: dugmad +1 / +2 / +3 / faul za svakog igrača.
- **UNDO** ispravlja grešku u sekundi (poništava poslednji upis) — bez precrtavanja i nečitljivih ispravki.
- Sistem automatski sprečava nemoguće situacije (npr. igrač sa 5 faulova se automatski isključuje).

### Sudija
- Vidi sve svoje dodeljene utakmice i ko mu je kolega na meču.
- Ima digitalnu **licencu** u aplikaciji.

---

## 6. Fokus: šta dobija DELEGAT

> Pošto aplikaciju prezentujemo delegatu, ovo je deo na koji treba staviti najveći naglasak. Delegat je **operativni gospodar lige na terenu** — i aplikacija mu posao čini drastično lakšim.

Delegat ima **tri glavna ekrana (taba)**:

### Tab 1: Utakmice (operativa)
- **Kalendar svih utakmica** iz svih liga za koje je delegat zadužen, na jednom mestu.
- Dani sa utakmicama su jasno označeni; utakmica koja je **uživo pulsira** kao indikator.
- Klik na utakmicu otvara **glavni operativni ekran**.

### Glavni ekran utakmice — ovde delegat „vlada"
Na jednom ekranu delegat:
1. Vidi **karticu „Uslovi za početak"** sa zelenim/crvenim kvačicama:
   - ✓/✗ Sastavi oba tima (5–12 igrača)
   - ✓/✗ Dodeljene 2 sudije
   - ✓/✗ Dodeljen zapisničar
   - ✓/✗ Vreme početka je stiglo
2. **Dodeljuje sudije** (do 2 po utakmici) iz baze sudija svoje lige — par klikova.
3. Kad su svi uslovi ispunjeni, pritiska **POČNI UTAKMICU** (uz zvuk pиštaljke).
4. Tokom meča **prati zapisnik uživo** — vidi svaki koš dok se dešava.
5. Na kraju pritiska **KRAJ UTAKMICE** — rezultat se zaključava.

**Poenta za delegata:** umesto da zove ljude, proverava papire i ručno koordinira, **sve radi sa jednog ekrana, a sistem ga štiti od grešaka** — ne da da se utakmica pokrene dok nije sve spremno.

### Tab 2: Takmičenje (uvid)
- Bira ligu i odmah vidi **tabelu**, **najbolje strelce grupe** i **najbolje strelce lige**.
- Može da uđe u profil bilo kog kluba ili igrača.
- Nema više čekanja da neko sastavi tabelu — ona je uvek tačna i ažurna.

### Tab 3: Sudije (kadrovi)
- Lista svih sudija u ligi sa **brojem odsuđenih utakmica**.
- Pretraga i sortiranje.
- **Kreira nove sudije** direktno (sa digitalnom licencom — može i PDF licence).
- Klik na sudiju otvara njegov profil.

### Prigovori — delegat je sudija žalbi
Kada trener uloži prigovor na zapisnik (u kratkom roku posle meča), delegat to vidi na ekranu završene utakmice:
- Kartica jasno pokazuje status: **nema prigovora** (zeleno), **ima prigovor za rešavanje** (crveno), ili **rešeno** (žuto).
- Delegat otvara prigovor, vidi razlog, ko ga je podneo i kada, pa pritiska **USVOJI** ili **ODBIJ**.
- Odluka se trajno beleži (ko je rešio i kada).

### Sažetak vrednosti za delegata
| Pre (papir) | Sa aplikacijom |
|-------------|----------------|
| Zove klubove da provere sastave | Vidi sastave na ekranu, automatski |
| Ručno koordinira sudije telefonom | Dodeljuje sudije iz baze, par klikova |
| Nada se da je sve spremno za početak | Sistem ne da da počne dok nije sve spremno |
| Papirni zapisnik koji treba sačuvati | Elektronski zapisnik, trajno i sigurno |
| Tabela kasni, prekucava se ručno | Tabela tačna i ažurna istog trenutka |
| Prigovori se rešavaju neformalno | Prigovori dokumentovani, odluka zabeležena |
| Nema evidencije angažovanja sudija | Vidi tačno koliko je ko sudio |

---

## 7. Strateška vrednost za srpsku košarku

Ovaj deo je „veliki cilj" — ono što treba da pokrene oduševljenje kod celnika.

### Objektivna selekcija = bolji igrači

Kada se učinak meri brojkama sa terena kroz celu sezonu i karijeru:

- **Talenat se vidi bez obzira na to ko mu je roditelj.** Ako dete daje poene, to je u sistemu, crno na belo. Selektori i skauti mogu da gledaju **rezultate**, ne reputaciju porodice.
- **Pravednija selekcija** znači da u reprezentativne i klupske selekcije ulaze **stvarno najbolji**, a ne najpromovisaniji.
- Bolja selekcija na vrhu znači **kvalitetnije mlade igrače** kroz ceo sistem.

### Bolji igrači = vrednija srpska košarka

- Kvalitetnije generacije znače **jače klubove i jaču reprezentaciju**.
- Igrači sa dokumentovanom, objektivnom statistikom su **lakši za skauting i transfer** — domaći i strani klubovi mogu da vide proverljive podatke o učinku.
- To znači **veću tržišnu vrednost igrača** i **prihod za klubove i ligu** kroz prodaju i razvoj talenata.
- Dugoročno: **srpska košarka koja proizvodi i prepoznaje talenat sistematski, a ne slučajno.**

### Poruka u jednoj rečenici
> „Digitalizacijom lige ne pravimo samo aplikaciju — pravimo **sistem koji prepoznaje talenat na osnovu rezultata** i tako podiže kvalitet cele srpske košarke, od najmlađih kategorija do reprezentacije."

---

## 8. Kome se obraćamo i kojim redom

Cilj je da se rešenje svidi **svim nivoima vlasti u košarci**, ali redosled ubeđivanja ide po hijerarhiji moći i interesa:

### 1) Savez (vrh — najveći interes)
**Šta savez dobija:** kontrolu i uvid nad celom zemljom, objektivnu sliku kvaliteta svih mlađih selekcija, digitalizaciju koja podiže ugled lige, i temelj za bolju nacionalnu selekciju.
**Poruka savezu:** *„Dobijate alat koji digitalizuje celu ligu i prvi put vam daje objektivnu, proverljivu sliku kvaliteta mladih igrača u celoj Srbiji. To je osnova za jaču reprezentaciju i vredniju košarku."*

### 2) Delegat (naš direktni sagovornik — operativna korist)
**Šta delegat dobija:** drastično lakši posao na terenu (vidi sekciju 6), bez papira, sa zaštitom od grešaka i automatskim tabelama.
**Poruka delegatu:** *„Vaš posao postaje brži, lakši i pouzdaniji. Vodite celu ligu sa telefona, a sistem vas štiti da nijedna utakmica ne krene dok nije sve po pravilima."*

### 3) Klubovi (baza — svakodnevna korist)
**Šta klub dobija:** evidenciju članova, digitalne članarine, statistiku svojih igrača, vidljivost u ligi.
**Poruka klubovima:** *„Sve o vašem klubu na jednom mestu — članovi, članarine, sastavi i statistika. Vaši igrači postaju vidljivi na osnovu onoga što pokažu na terenu."*

**Logika redosleda:** ako savez prihvati i podrži, delegat dobija mandat da uvede sistem; kada delegat vidi koliko mu olakšava posao, postaje ambasador; klubovi se pridružuju jer im sistem donosi red i vidljivost.

---

## 9. Kako uživo prezentovati — scenario sa 7 telefona

Tvoja ideja je odlična i preporučujem je: **jedan telefon po ulozi**, svaki već prijavljen na svoj nalog. Time se izbegava stalno odjavljivanje/prijavljivanje i sagovornik **nikad nije zbunjen gde se trenutno nalaziš**.

### Priprema (uradi pre sastanka)
- **7 telefona**, svaki prijavljen na svoju ulogu i obeležen nalepnicom:
  1. **SAVEZ**
  2. **DELEGAT** ← (telefon koji najviše koristiš, jer je sagovornik delegat)
  3. **KLUB**
  4. **TRENER**
  5. **ZAPISNIČAR**
  6. **IGRAČ**
  7. **SUDIJA**
- Na svakom telefonu unapred otvori **tačan ekran** koji ćeš prvi pokazati (da ne tražiš uživo).
- Pripremi **jednu „demo" utakmicu** koja je zakazana i spremna, tako da uživo možeš da je pokreneš i odigraš par poena.
- Telefone poređaj na sto **po hijerarhiji** (savez levo, pa delegat, pa naniže) — vizuelno priča priču o lancu odgovornosti.
- Obezbedi da su svi na istoj Wi-Fi/internet mreži da bi **realtime** sinhronizacija radila uživo (efekat „aha!").
- Poželjno: pripremi i jednu **rezervu** (screenshot/snimak) ako internet zakaže.

### Zašto baš ovako
- Sagovornik **vidi sve uloge istovremeno** i shvata da je to **jedan povezan sistem**, a ne 7 odvojenih aplikacija.
- Kada na jednom telefonu (zapisničar) upišeš koš, a na drugom (igrač/klub/delegat) se **rezultat promeni uživo** — to je najjači mogući „wow" momenat.
- Nema gubljenja vremena na login/logout, nema zabune.

---

## 10. Redosled prezentacije korak po korak

Vodi sagovornika **kroz priču o jednoj utakmici**, jer tako sistem ima najviše smisla. Predloženi tok:

### Korak 0 — Uvod (1–2 min)
Otvori temu problemom, ne aplikacijom:
> *„Danas se liga vodi na papiru. Rezultati kasne, statistike nema, a ko će biti zapažen prečesto zavisi od roditelja, a ne od igre. Pokazaću vam kako to menjamo."*

### Korak 1 — Pristup i bezbednost (1 min)
Pokaži **login ekran** (lepa intro animacija sa logom).
> *„Primetićete — nema dugmeta za registraciju. Niko se ne upisuje sam. Nalog vam daje isključivo neko iznad vas u hijerarhiji. To znači potpunu kontrolu i poverenje u svaki podatak."*

Objasni lanac: savez → delegat/klub/sudija; klub → igrač/trener/zapisničar.

### Korak 2 — Savez postavlja ligu (2 min) — *telefon SAVEZ*
Pokaži strukturu: regije → lige → grupe → klubovi, i kako savez **zakazuje utakmicu**.
> *„Savez postavlja celu piramidu i zakazuje meč. Čim je zakazan, svi ga vide."*

### Korak 3 — Priprema utakmice (3 min) — *telefoni KLUB i TRENER*
- **Klub** dodeljuje zapisničara na domaću utakmicu.
- **Trener** prijavljuje sastav (brojevi dresova).
> *„Svako radi svoj deo. Sistem skuplja sve na jedno mesto."*

### Korak 4 — DELEGAT preuzima kontrolu (4–5 min, NAJVAŽNIJE) — *telefon DELEGAT*
Ovo je centar prezentacije. Polako i detaljno:
- Pokaži **kalendar** sa utakmicama.
- Uđi u utakmicu i pokaži **karticu „Uslovi za početak"** — objasni svaku kvačicu.
- **Dodeli 2 sudije** uživo, par klikova.
- Pokaži da je dugme **„Počni utakmicu" zaključano** dok nešto fali, pa kako se **otključa** kad je sve spremno.
> *„Ovo je vaš ekran. Vidite tačno šta fali, dodelite sudije, i pokrećete meč tek kad je sve po pravilima. Sistem vas štiti od grešaka."*

### Korak 5 — Utakmica uživo (4 min, „WOW" momenat) — *telefoni ZAPISNIČAR + ostali*
- Na telefonu **ZAPISNIČAR** upiši nekoliko koševa (+2, +3, faul) i pokaži **UNDO**.
- Istovremeno pokaži kako se **na telefonima IGRAČ / KLUB / DELEGAT rezultat menja uživo**.
> *„Jedan unos hrani ceo sistem — i sve se vidi u realnom vremenu, gde god da ste."*

### Korak 6 — Kraj i rezultat (2 min) — *telefon DELEGAT*
- Delegat pritiska **KRAJ UTAKMICE**.
- Pokaži kako se odmah pojavljuje **box score** (učinak svakog igrača).

### Korak 7 — Šta sistem automatski napravi (3 min) — *telefoni SAVEZ / IGRAČ*
- Pokaži **ažuriranu tabelu** i **listu strelaca** (telefon savez/delegat).
- Pokaži **statistiku igrača** — sezona i karijera (telefon igrač).
> *„Niko ništa nije prekucavao. Tabela, strelci i statistika svakog igrača — automatski, iz onoga što se desilo na terenu."*

### Korak 8 — Prigovor (2 min) — *telefoni TRENER → DELEGAT*
- Trener uloži prigovor, delegat ga **USVOJI/ODBIJ**.
> *„Čak su i žalbe dokumentovane i rešavaju se transparentno."*

### Korak 9 — Veliki cilj (2–3 min, zatvaranje)
Vrati se na viziju (sekcija 7):
> *„Ovo nije samo digitalizacija papira. Ovo je sistem koji prepoznaje talenat na osnovu rezultata — i tako pravi bolje igrače, jače klubove i vredniju srpsku košarku. Selekcija po zasluzi, ne po vezama."*

### Trajanje
Ceo demo: **~25–30 minuta** + pitanja. Ako imaš manje vremena, srž je: **Korak 4 (delegat) + Korak 5 (uživo) + Korak 7 (automatska statistika)**.

---

## 11. Anticipirana pitanja i odgovori

**„Šta ako nema interneta u dvorani?"**
Tok rada je dizajniran oko jasnih koraka; sinhronizacija se dešava čim se mreža vrati. (Za demo: imaj rezervni snimak.)

**„Ko garantuje da je statistika tačna?"**
Zapisnik vodi samo ovlašćeni zapisničar kog je dodelio klub, utakmicu otvara i zaključava delegat, a svaki upis se beleži sa vremenom i autorom. Postoji i UNDO za ispravke i prigovor kao kontrolni mehanizam.

**„Može li neko da upadne u sistem ili da napravi lažni nalog?"**
Ne. Nema samostalne registracije. Nalog dodeljuje isključivo nadređena uloga. Svaka uloga vidi samo svoje.

**„Da li je teško za korišćenje?"**
Svaka uloga vidi samo ono što joj treba. Zapisničar ima samo dugmad +1/+2/+3/faul i UNDO. Delegat ima jasne kvačice i dva dugmeta (počni/kraj).

**„Šta sa starim podacima na papiru?"**
Sistem kreće da gradi digitalnu istoriju od uvođenja; svaka naredna utakmica obogaćuje bazu statistike.

**„Da li radi na svakom telefonu?"**
Da — aplikacija radi na Android i iOS uređajima.

---

## 12. Tehnička osnova (ukratko)

*(Za slučaj da neko pita „na čemu je ovo napravljeno" — ali ovo nije fokus prezentacije.)*

- **Mobilna aplikacija:** React Native + Expo (Android i iOS iz iste baze koda).
- **Backend i baza:** Supabase (PostgreSQL) — siguran, skalabilan, sa sinhronizacijom u realnom vremenu.
- **Model podataka:** svaki događaj na utakmici (koš/faul) je poseban, vremenski označen zapis; sve agregacije (rezultat, tabela, statistika) računaju se automatski iz tih događaja.
- **Bezbednost:** kontrola pristupa na nivou baze; nalozi se kreiraju isključivo preko zaštićene serverske funkcije uz proveru ovlašćenja.
- **Skalabilnost:** sistem je projektovan da podrži celu ligu kroz celu sezonu (stotine hiljada događaja).

---

### Završna napomena

Ovaj dokument je namerno opširan da bi ti imao materijal za skraćivanje i prilagođavanje. Za sam nastup, zapamti tri stuba poruke:

1. **Digitalizacija** — papir nestaje, sve je na jednom mestu, odmah.
2. **Objektivnost** — talenat se vidi po rezultatu, ne po vezama.
3. **Strateški cilj** — bolja selekcija = bolji igrači = vrednija srpska košarka.

A za delegata, jedna rečenica koja sve sažima:
> *„Vodite celu ligu sa telefona — brže, lakše i bez ijednog papira, a sistem vas čuva od grešaka."*
