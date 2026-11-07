# Demo specifikacija: kurjerių maršrutų planavimas su Google Route Optimization API

Versija: 0.5, 2026-11-07

## 1. Tikslas

Parodyti klientui, kaip Google Route Optimization API automatiškai paskirsto paketus
kurjeriams ir sudėlioja pristatymo eiliškumą, atsižvelgiant į paketų prioritetą ir
pristatymo laiką. Rezultatas – po vieną PDF failą kiekvienam kurjeriui su jo dienos
maršrutu.

Demo yra "smulkus": vienas CLI paleidimas, kuris sugeneruoja planą ir PDF, plius minimalus
web dashboard (Vite), kuris nupiešia maršrutus žemėlapyje. Be duomenų bazės, be autentifikacijos.

## 2. Apimtis

Įeina:
- Sintetiniai duomenys: 1 sandėlis, 10 kurjerių, ~60–80 paketų Vilniaus mieste.
- Kiekvienas paketas turi prioritetą ir pristatymo laiko langą.
- Vienas kreipimasis į Route Optimization API (`optimizeTours`).
- PDF kiekvienam kurjeriui: ką paimti sandėlyje, kur vežti, kokia tvarka, kada.
- Bendra suvestinė (JSON + trumpa konsolės lentelė).
- Minimalus dashboard (Vite + React + Leaflet): žemėlapis su sandėliu, kurjerių maršrutais ir
  sunumeruotomis stotelėmis, kurjerių sąrašas su metrikomis, nuorodos į PDF.
- `--mock` režimas, kad demo veiktų ir be GCP paskyros (paprastas lokalus algoritmas).

Neįeina:
- Realaus laiko sekimas, kurjerio programėlė, vairuotojo navigacija.
- Adresų geokodavimas iš laisvo teksto (duomenyse iš karto yra koordinatės).
- Kelių dienų planavimas, pakartotiniai vizitai, grąžinimai.
- Keli sandėliai (galima pridėti vėliau, modelis tai palaiko).

## 3. Verslo taisyklės

### 3.1 Paketai
Kiekvienas paketas turi:
- `id` – pvz. `PKG-001`.
- `recipient` – gavėjo vardas / įmonė.
- `address` – adresas rodymui PDF'e.
- `lat`, `lng` – pristatymo koordinatės.
- `priority` – `1` (aukštas), `2` (vidutinis), `3` (žemas).
- `deliveryWindow` – `{ start, end }` – norimas pristatymo laikas (pvz. 09:00–12:00).
- `weightKg` – svoris (talpos ribojimui).
- `serviceMinutes` – kiek užtrunka perdavimas (numatyta 5 min).

Visi paketai paimami sandėlyje dienos pradžioje (kurjeris startuoja iš sandėlio jau su
savo paketais, todėl modelyje pickup = sandėlis, laiko kaštų jam neskiriame).

### 3.1a Gavėjai
Klientas daugiausia veža **fiziniams asmenims** ir **autoservisams** (`recipientType`:
`person` / `autoservice`, numatyta 65 / 35 %, keičiama `autoservicePct` generuojant).
- Autoservisai: darbo laikas 08:00–17:00, skubūs (p1) siuntiniai rytą („automobilis ant keltuvo"),
  sunkesnės autodalys 2–30 kg (diskai, padangos, akumuliatoriai), aptarnavimas 5–10 min.
- Fiziniai asmenys: smulkūs siuntiniai 0.5–15 kg, aptarnavimas 3–6 min, butų numeriai adresuose.
- PDF ir dashboard autoservisą pažymi atskirai.

### 3.2 Kurjeriai
10 kurjerių, kiekvienas:
- `id`, `name`, telefonas (rodymui).
- Startas ir pabaiga – sandėlis.
- Darbo laikas – 08:00–18:00.
- Talpa – pvz. 150 kg (keli kurjeriai su mažesne talpa, kad būtų matyti ribojimas).
- Kaštai – `costPerHour` ir `costPerKilometer`, kad optimizatorius minimizuotų laiką ir km.

### 3.3 Prioritetas ir laiko langai (kaip verčiama į API)
Route Optimization API neturi tiesioginio "prioriteto" lauko. Modeliuojame taip:
- **Prioritetas → `penaltyCost`** (bauda, jei paketas nepristatomas):
  - 1 → labai didelė bauda (praktiškai privaloma pristatyti),
  - 2 → vidutinė,
  - 3 → maža (jei netelpa į dieną, optimizatorius gali jį praleisti).
- **Laiko langas → `timeWindows`** su minkšta pabaiga:
  - `startTime` – kieta riba (anksčiau nepristatoma),
  - `softEndTime` – pageidaujama pabaiga, `costPerHourAfterSoftEndTime` priklauso nuo prioriteto
    (1 prioritetas vėluoti brangiausia),
  - `endTime` – kieta riba = darbo dienos pabaiga.

- **Darbo krūvio balansavimas → `routeDurationLimit`**: kiekvienam kurjeriui kvadratinė maršruto
  trukmės kaina nuo 0 h (`COST_TUNING.balanceCostPerSquareHour`, numatyta 8). Be jo API viską
  sukrauna ant 3–5 kurjerių. Su juo `normal` rinkinyje dirba visi 10, už ~30 % daugiau km.

Nepristatyti paketai (`skippedShipments`) rodomi suvestinėje atskirai su priežastimi.

## 4. Techninis sprendimas

### 4.1 Stekas
- Node.js 20+, TypeScript, npm workspaces: `@marsrutai/shared` (tipai, zod schemos, API kontraktas),
  `@marsrutai/cli` (generatorius, optimizatoriai, PDF), `@marsrutai/server` (lokalus HTTP serveris, 5b),
  `@marsrutai/dashboard` (Vite).
- `@googlemaps/routeoptimization` – oficialus klientas (`optimizeTours`).
- `pdfkit` – PDF generavimas.
- Dashboard: Vite + React + TypeScript, `react-leaflet` su OpenStreetMap plytelėmis (nereikia
  API rakto). Polilinijos iš API dekoduojamos su `@googlemaps/polyline-codec`. Alternatyva – Google
  Maps JS API (`@vis.gl/react-google-maps`), jei klientas nori matyti "Google" žemėlapį; reikalauja rakto.
- Maps Static API – žemėlapio paveikslėlis su maršruto polilinija kiekviename PDF (pasirinktinai,
  įjungiama su `--maps`; reikalauja API rakto).
- `zod` – įvesties duomenų validacija.
- Paleidimas: `npm run demo` (realus API) arba `npm run demo -- --mock`; interaktyviai – `npm run dev`
  (serveris + dashboard).

### 4.2 Autentifikacija ir API klientas
- GCP projektas: `marsrutai-digimuza`, billing „Digimuza", `routeoptimization.googleapis.com` įjungtas.
- **Sprendimas**: vietoj gRPC kliento `@googlemaps/routeoptimization` naudojame REST
  `POST https://routeoptimization.googleapis.com/v1/projects/{project}:optimizeTours` per `fetch`.
  Paprastesnė priklausomybė, lengviau derinti, tas pats JSON formatas kaip dokumentacijoje.
- Tokenas: pirmiausia ADC per `google-auth-library`; jei ADC nėra, fallback į
  `gcloud auth print-access-token`. Antraštė `x-goog-user-project: <projektas>`.
- Env `GOOGLE_CLOUD_PROJECT` (numatyta `marsrutai-digimuza`).
- Static Maps (jei naudojama): `GOOGLE_MAPS_API_KEY`.

### 4.3 Katalogų struktūra
```
marsrutai-laurynas/
  SPEC.md, README.md
  package.json          # npm workspaces: packages/*; dev = server + dashboard (concurrently)
  .env.example
  data/
    normal.json         # Vilniaus demo rinkinys (~70 paketų), Dataset
    overload.json       # per daug paketų (~140), Dataset
    scenarios/          # <miestas>.json – redaktoriaus scenarijai (gitignore)
  packages/
    shared/             # @marsrutai/shared
      src/types.ts      # Dataset, Plan, Optimizer + zod schemos
      src/api.ts        # serverio HTTP kontraktas (5b)
      src/names.ts      # slugify, courierPdfFileName (vienintelė PDF vardų taisyklė)
      fixtures/sample-plan.json
    cli/                # @marsrutai/cli (exports: ./api ./mock ./pdf ./generate ./load ./summary)
      src/
        index.ts        # CLI įėjimo taškas (npm run demo)
        load.ts         # duomenų nuskaitymas ir validacija
        summary.ts      # summary.md ir konsolės lentelė
        api/            # Route Optimization API: request.ts, client.ts, response.ts, auth.ts
        mock/           # lokalus optimizatorius (--mock)
        pdf/            # Plan → PDF kiekvienam kurjeriui (pdfkit)
        generate/       # generatorius: miestai, kuruoti Vilniaus/Kauno adresai, kurjeriai
      scripts/
        gen-data.ts     # data/normal.json ir overload.json (deterministinis seed)
    server/             # @marsrutai/server (hono), žr. 5b
      src/app.ts        # endpoint'ai
      src/index.ts      # paleidimas, PORT (numatyta 8787)
    dashboard/          # @marsrutai/dashboard, Vite + React
  out/                  # rezultatai (gitignore)
    plan.json, summary.md, courier-NN-vardas.pdf   # CLI (npm run demo)
    vilnius/, kaunas/   # serveris: plan.json, summary.md, PDF, pdfs.zip
```

### 4.3a Kontraktai
- Visi tipai ir zod schemos: `packages/shared/src/types.ts` (`Dataset`, `Plan`, `Optimizer`).
- Duomenų rinkiniai: `data/normal.json` ir `data/overload.json`, kiekvienas yra `Dataset`.
- Pavyzdinis planas kūrimui be optimizatoriaus: `packages/shared/fixtures/sample-plan.json`.
- Laikai `Plan` viduje: ISO 8601 su Vilniaus poslinkiu (`+02:00` lapkritį).

### 4.4 Duomenų srautas
1. `load.ts` nuskaito ir validuoja `data/*.json`.
2. `api/request.ts` sukuria `OptimizeToursRequest`:
   - `model.globalStartTime/EndTime` – demo diena 08:00–18:00,
   - `shipments[]` – po vieną paketui: `deliveries[0]` su koordinatėmis, `duration`,
     `timeWindows`; `loadDemands.weight`; `penaltyCost`,
   - `vehicles[]` – po vieną kurjeriui: `startLocation`/`endLocation` = sandėlis,
     `startTimeWindows`/`endTimeWindows`, `loadLimits.weight`, `costPerHour`, `costPerKilometer`,
   - `populatePolylines: true`, `considerRoadTraffic: false` (demo determinizmui).
3. `api/client.ts` kviečia `optimizeTours` (arba `mock/`, jei `--mock`).
4. `api/response.ts` paverčia atsakymą į `Plan` (tikslus tipas – `PlanSchema` faile `shared/src/types.ts`):
   ```
   Plan {
     generatedAt, depot,
     routes: [{ courier, stops: [{ seq, package, eta, etd, distanceFromPrevKm }],
                totalKm, totalMinutes, totalWeightKg, polyline? }],
     skipped: [{ package, reason }],
     metrics: { totalKm, totalHours, deliveredCount, skippedCount, lateCount }
   }
   ```
5. `pdf/` generuoja PDF kiekvienam kurjeriui; `out/plan.json` ir `out/summary.md` – bendrai.
6. Dashboard nuskaito `out/plan.json` ir nupiešia jį žemėlapyje (žr. 5a skyrių). `plan.json`
   yra vienintelė sąsaja tarp CLI ir dashboard, todėl juos galima vystyti atskirai.

### 4.5 Mock režimas
Godus *cheapest insertion* algoritmas: paketai rikiuojami pagal prioritetą ir lango pradžią,
kiekvienas įterpiamas ten (bet kuris kurjeris, bet kuri pozicija), kur pigiausia, jei tenkinama
talpa, grįžimas iki darbo pabaigos ir joks 1 prioriteto paketas nevėluoja; 2/3 prioritetas gali
vėluoti su bauda. Kaina = kurjerio €/h ir €/km + vėlavimo baudos + krūvio balansavimas. Jei
niekur netelpa – paketas `skipped` su priežastimi. Atstumas – Haversine × 1.3, greitis 25 km/h mieste. Tikslas – kad PDF ir
suvestinė atrodytų realistiškai be GCP. PDF'e aiškiai pažymima "MOCK".

**Kelių geometrija**: mock laikus skaičiuoja tiesėmis × 1.3, bet maršruto `path` gaunamas iš OSRM
(`router.project-osrm.org`, keičiama `OSRM_URL`), kad žemėlapyje ir PDF maršrutas eitų gatvėmis.
Jei OSRM nepasiekiamas, paliekamos tiesės su įspėjimu. Testuose išjungiama `MARSRUTAI_ROAD_GEOMETRY=off`.

## 5. PDF turinys (vienam kurjeriui)

Puslapis A4, 1–2 lapai:
1. **Antraštė**: kurjerio vardas, data, sandėlis, išvykimo laikas, planuojamas grįžimas,
   bendras atstumas, paketų kiekis, bendras svoris.
2. **Pakrovimo sąrašas** (ką paimti sandėlyje): lentelė `#`, `Paketo ID`, `Gavėjas`, `Svoris`,
   `Prioritetas` – surikiuota atvirkštine pristatymo tvarka (paskutinis pristatomas kraunamas
   pirmas), su žymimaisiais langeliais.
3. **Maršrutas**: lentelė `Eil. nr.`, `Atvykimas`, `Paketo ID`, `Gavėjas`, `Adresas`,
   `Langas`, `Prioritetas`, `Pastaba` (pvz. "vėluoja 12 min" raudonai).
4. **Žemėlapis** (jei `--maps`): Static Maps paveikslėlis su sunumeruotais taškais ir polilinija.
4a. **Navigacija Google Maps** (iškart po antrašte): QR kodas ir paspaudžiama nuoroda
   `https://www.google.com/maps/dir/?api=1&origin=…&waypoints=…&destination=…&travelmode=driving`
   su stotelėmis eilės tvarka. Google Maps vienoje nuorodoje leidžia iki 9 tarpinių taškų, todėl
   ilgas maršrutas skaidomas į dalis po ≤ 10 stotelių: kita dalis prasideda paskutine ankstesnės
   stotele, paskutinė grįžta į sandėlį. Logika bendra: `courierNavLinks` iš `@marsrutai/shared`
   (naudoja ir dashboard).
5. **Poraštė**: "Sugeneruota su Google Route Optimization API" arba "MOCK režimas".

Prioritetas žymimas spalva: 1 – raudona, 2 – geltona, 3 – pilka.

## 5a. Dashboard (Vite)

**UI kūrimo taisyklė**: visas dashboard UI kuriamas ir tobulinamas su `impeccable` skill'u
(`pbakaus/impeccable`). Paviršiaus režimas yra „Operate", todėl svarbiausia skaitomumas,
nuoseklumas ir tikslios detalės. Produkto kontekstas laikomas `PRODUCT.md`, dizaino sistema
`DESIGN.md`. Prieš pristatymą privalomi `impeccable polish` ir `impeccable audit`.

Minimalus, vieno puslapio, be routing'o ir be backend'o. Paleidimas: `npm run dev:web` (arba kartu su serveriu `npm run dev`, žr. 5b),
Vite dev serveris servuoja `out/` katalogą kaip `/out`, todėl `plan.json` ir PDF pasiekiami tiesiogiai.

Layout: kairėje šoninė juosta (~320 px), dešinėje žemėlapis per visą likusį plotą.

**Žemėlapis** (`RouteMap.tsx`):
- Sandėlis – išskirtinis žymeklis (namo ikona).
- Kiekvieno kurjerio maršrutas – polilinija savo spalva (10 skirtingų spalvų paletė). Jei API grąžino
  `polyline`, piešiama tikra kelių geometrija; mock režime – tiesės tarp stotelių.
- Stotelės – apskritimo žymekliai su eilės numeriu, spalva kaip kurjerio. Paspaudus – popup su
  paketo ID, gavėju, adresu, ETA, langu, prioritetu, vėlavimu.
- Nepristatyti paketai – pilki žymekliai su "×".
- Pradinis `fitBounds` į visas stoteles.

**Šoninė juosta**:
- `Summary.tsx`: bendri skaičiai (paketai, pristatyta, nepristatyta, km, valandos, vėluoja), režimas
  (API / MOCK), sugeneravimo laikas.
- `CourierList.tsx`: eilutė kiekvienam kurjeriui – spalvos taškas, vardas, stotelių sk., km, val.,
  kg / talpa, vėluojančių sk., nuoroda „PDF". Checkbox'as rodyti / slėpti maršrutą; mygtukas „tik šis"
  izoliuoja vieną kurjerį. Užvedus pelę – maršrutas žemėlapyje paryškinamas.
- Mygtukas „Perkrauti planą" – pakartotinai nuskaito `plan.json` (po naujo CLI paleidimo).

Neįeina (galima vėliau): optimizacijos paleidimas iš naršyklės, duomenų redagavimas,
stotelių perstumdymas drag-and-drop, realaus laiko pozicijos.

## 5b. Interaktyvus scenarijų redaktorius (v0.4)

Vartotojas pats susikuria demo scenarijų dashboard'e ir iš jo sugeneruoja maršrutus bei PDF.

**Miestas**: viršuje perjungiklis „Vilnius / Kaunas". Kiekvienas miestas turi savo sandėlį
ir žemėlapio centrą. Scenarijus vienu metu yra vieno miesto: Kaune esantis kurjeris nevažiuoja į
Vilnių. Perjungus miestą, dabartinis scenarijus išsaugomas ir užkraunamas to miesto scenarijus.

**Paketai**:
- Mygtukas „Generuoti atsitiktinius": kiekis (numatyta 30) ir prioritetų pasiskirstymas
  (numatyta 20 / 45 / 35 %). Taškai imami iš kuruoto realių to miesto adresų sąrašo su
  ~50 m paklaida, kad nepatektų į upę ar mišką. Galima „pridėti" arba „pakeisti visus".
- Paspaudus ant žemėlapio, pridedamas paketas tame taške. Atsiranda forma: prioritetas 1/2/3,
  laiko langas, svoris, gavėjas, adresas. Adresas numatytai būna „lat, lng"; atvirkštinis
  geokodavimas neįeina.
- Paspaudus ant paketo žymeklio: keisti prioritetą, langą, svorį arba ištrinti. Žymeklio
  spalva rodo prioritetą.
- Mygtukas „Išvalyti paketus".

**Kurjeriai**:
- Sąrašas su mygtuku „Pridėti kurjerį". Laukai: vardas (numatytai sugeneruojamas lietuviškas),
  talpa kg, pamainos pradžia ir pabaiga, transporto tipas. Spalva parenkama automatiškai iš paletės.
- Kurjerį galima redaguoti ir ištrinti. Numatytai naujame scenarijuje yra 10 kurjerių.

**Optimizavimas**:
- Mygtukas „Sudaryti maršrutus" su pasirinkimu „Google API / Mock". Serveris paleidžia optimizatorių,
  įrašo `out/<miestas>/plan.json`, sugeneruoja PDF kiekvienam kurjeriui ir grąžina planą.
- Po optimizacijos žemėlapis rodo maršrutus kaip 5a skyriuje. Paketų redagavimas paslepia
  pasenusius maršrutus ir rodo žymą „planas pasenęs".
- Prie kiekvieno kurjerio yra nuoroda „PDF" ir bendras mygtukas „Atsisiųsti visus PDF" (ZIP).

**Lokalus serveris** `packages/server` (Node, `hono` arba `node:http`), paleidžiamas kartu su Vite
per `npm run dev`. Vite proxy'ina `/api` ir `/out` į serverį.

| Metodas | Kelias | Aprašas |
|---|---|---|
| GET | `/api/cities` | miestų sąrašas: id, pavadinimas, sandėlis, centras, ribos |
| GET | `/api/scenario?city=vilnius` | dabartinis `Dataset` (jei nėra, sukuriamas tuščias su 10 kurjerių) |
| PUT | `/api/scenario?city=vilnius` | išsaugo `Dataset` į `data/scenarios/<miestas>.json` |
| POST | `/api/generate` | `{city, count, mix:{p1,p2,p3}, seed?}`, grąžina naujus `Package[]` (neįrašo) |
| POST | `/api/optimize` | `{city, mode:"api"\|"mock"}`, grąžina `Plan` ir PDF failų sąrašą |
| GET | `/api/pdfs.zip?city=vilnius` | visi to miesto PDF vienu ZIP |
| GET | `/api/plan?city=vilnius` | paskutinis `OptimizeResponse` (atkuriamas iš `out/<miestas>/plan.json`) arba 404 |
| GET | `/out/**` | statiniai rezultatai (plan.json, PDF) |

Bendri užklausų / atsakymų tipai – `packages/shared/src/api.ts`.

Realizacija (v0.5):
- Serveris: `packages/server`, `hono` + `@hono/node-server`, `PORT` (numatyta 8787). Naudoja
  `@marsrutai/cli` modulius (generatorius, optimizatoriai, PDF), kodas nedubliuojamas.
- Miestai: Vilnius (sandėlis Kirtimai, Savanorių pr. 178) ir Kaunas (sandėlis Naujasodis,
  Draugystės g. 19). Kauno adresai (167) geokoduoti per OpenStreetMap ir patikrinti, kad būtų
  ≥ 50 m nuo vandens; jitter ≤ 40 m.
- Naujas scenarijus: kita darbo diena (Europe/Vilnius), 10 kurjerių, 0 paketų. GET jo neįrašo.
- PUT validuoja `ScenarioSchema` ir papildomai: unikalūs ID, pradžia < pabaiga.
- Optimizavimas naudoja išsaugotą scenarijų; 0 paketų arba 0 kurjerių → 400. Vienu metu – vienas
  optimizavimas miestui. Prieš generuojant PDF seni PDF ištrinami; `out/<miestas>/pdfs.zip`.
- Klaidos – `ApiErrorSchema` JSON lietuviškai; validacijos klaidos `details.issues[{path, message}]`;
  Google API / autentifikacijos klaidos → HTTP 502 su `details.hint`.
- Stotelės `arrival` visur reiškia atvykimą prie durų; aptarnavimas prasideda `arrival + waitMinutes`.

## 6. Suvestinė (`out/summary.md` ir konsolė)

Lentelė per kurjerius: paketų sk., km, valandos, pakrauta kg / talpa, vėluojančių sk.
Žemiau – nepristatyti paketai ir bendri skaičiai. Tai klientui parodo "kodėl verta":
balansavimas, vėlavimų minimizavimas, kurie paketai netilpo.

## 7. Priėmimo kriterijai

- [ ] `npm run demo -- --mock` suveikia be jokių kredencialų ir sukuria 10 PDF + `plan.json`.
- [ ] `npm run demo` su ADC sukuria tą patį rinkinį naudodamas realų API atsakymą.
- [ ] Nė vienas 1 prioriteto paketas nėra `skipped` (su numatytais duomenimis).
- [ ] Nė vienas kurjeris neviršija talpos ir darbo laiko.
- [ ] PDF'e stotelių eiliškumas sutampa su API grąžinta `visits` tvarka.
- [ ] Pakrovimo sąrašas = tiksliai tie paketai, kurie yra maršrute.
- [ ] Duomenų generatorius deterministinis (tas pats seed → tie patys duomenys).
- [ ] `npm run dev:web` atidaro žemėlapį su visais 10 maršrutų, sandėliu ir stotelėmis iš `out/plan.json`.
- [ ] Kurjerių įjungimas / išjungimas ir „tik šis" veikia; paspaudus stotelę rodomas popup.
- [ ] Nuoroda „PDF" dashboard'e atidaro atitinkamą kurjerio PDF.
- [ ] `npm run build` sukuria statinį build'ą be klaidų.
- [ ] Dashboard'e galima pasirinkti Vilnių arba Kauną ir sugeneruoti atsitiktinius paketus to miesto ribose.
- [ ] Paspaudus žemėlapį, pridedamas paketas su pasirinktu prioritetu. Paketą galima redaguoti ir ištrinti.
- [ ] Kurjerius galima pridėti, redaguoti ir ištrinti.
- [ ] „Sudaryti maršrutus" su Google API sukuria maršrutus ir PDF kiekvienam kurjeriui. PDF atsidaro iš dashboard'o, veikia ir ZIP atsisiuntimas.
- [ ] README su paleidimo instrukcija ir GCP setup žingsniais.

## 8. Rizikos ir pastabos

- **Billing**: API mokamas už kiekvieną `shipment` (Fleet Routing SKU, kai >1 transporto
  priemonė). 70 paketų × keli paleidimai demo metu – nedidelė suma, bet billing turi būti įjungtas.
- **Determinizmas**: realus API gali grąžinti šiek tiek skirtingus sprendimus tarp paleidimų;
  demo metu geriau rodyti iš anksto sugeneruotus PDF arba paleisti su `considerRoadTraffic: false`.
- **Kvotos**: `optimizeTours` sinchroninis užklausoms iki ~8 MB; mūsų dydis tilps su atsarga.

## 9. Atviri klausimai (sprendžiama prieš implementaciją)

1. Miestas – Vilnius? (Prielaida: taip.)
2. Paketų kiekis demo – ~70 pakankamai, ar norite parodyti ir "per daug paketų" scenarijų,
   kur dalis 3 prioriteto lieka nepristatyta? (Prielaida: generuojame 2 rinkinius – `normal` ir `overload`.)
3. Ar reikia žemėlapio PDF'e (papildomas Static Maps raktas)? (Prielaida: pasirinktinai, `--maps`.)
3a. Dashboard žemėlapis – Leaflet + OpenStreetMap (be rakto) ar Google Maps JS (reikia rakto,
   bet vizualiai „Google")? (Prielaida: Leaflet; perjungti į Google Maps vėliau nesunku.)
4. PDF kalba – lietuvių? (Prielaida: taip.)
5. Ar turite GCP projektą su billing, ar demo pirmiausia rodome `--mock`, o realų API jungiame
   antrame etape? (Prielaida: realizuojame abu, pirma `--mock`.)
