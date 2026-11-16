# UbiMap - demo materials

Two options. Pick **one**.

* **Option A: a 30 second video.** The official guide: "Projects that exceed these limits
  will not be eligible for Global Judging."
* **Option B: a 7 slide deck.** Title and intro slides count toward the seven.

You may speak in Bisaya or Filipino in the video, but it **must have English subtitles**.
Slide decks must be in English.

The official beat sheet, verbatim from the guide:

| Time | Official instruction |
|---|---|
| [0:00] | "Introduce yourself: What is your name and your team's name?" |
| [0:02] | "Lead us in: What challenge does your project address? What inspired you to choose this challenge?" |
| [0:05] | "Name your project: Share your project's title and tagline to catch your audience's attention." |
| [0:10] | "Describe your idea: How does it work? Display images or a prototype, describe a user's experience, and share how using NASA's free and open data and Space Agency Partner data made your proposed solution possible." |
| [0:20-0:30] | "Look into the future: Paint a picture! Captivate your audience with what it could be." |

---

# Option A: the 30 second video

**The 30 second video is already recorded, voiced and hosted.** You do not have to
record it yourself unless you want your own voice on it.

> `https://ubimap.pages.dev/ubimap-demo.mp4`

It was captured from the live app with Chrome's DevTools screencast, so every
frame is the real interface with the real NASA data, with an English voiceover and
English subtitles burned in. Exactly 30.000 seconds.

A 53 second walkthrough of the whole app is hosted at
`https://ubimap.pages.dev/ubimap-demo-long.mp4`. **Do not put that one in the demo
field.** The guide is explicit that a longer video makes the project ineligible for
global judging. The long cut is for the project page.

If you want your own voice instead of the generated one, the shot list below is
what the video follows, and the subtitles are the English lines. Record your voice
over it and it will still be 30 seconds.

**Setup before you record.** Open the app on your phone at the demo field (tap "Use the
Pagadian demo field", then Continue, then Continue). The app opens in English, which is what
the judges read, so leave it in English for the recording. Have the app on a second phone or a
laptop so you can screen record it. Have the NASA map layer switched to MODIS Terra true
colour and the suitability heatmap on. Record in a quiet room, daylight if possible.

**The live NASA button works on the deployed site.** When you tap "Check live with NASA
POWER", the app calls the NASA POWER API through its Cloudflare Pages Function and the table
that appears holds real values for that field for the last few days, with the fetch time
shown. Record that tap. It is the single clearest proof that the data is live and not baked
in, and no other team in the field can show it.

**Rule:** read the "Subtitle" column aloud in your own voice. Burn the subtitle text into
the bottom of the frame. Do not read the English column aloud.

| Time | Shot on screen | Subtitle (burn in English) | What you say (Bisaya) |
|---|---|---|---|
| 0:00 to 0:02 | Your face, or your team name on screen | *Our team is [TEAM NAME]. I am [YOUR NAME].* | "Mga kaayo! Si [NAME], ang team nga [TEAM NAME]." |
| 0:02 to 0:05 | Slide: the ube photo, or the map of the Philippines with Zamboanga del Sur marked | *We address "Field Shift: Adapting Farms with NASA Data". Ube production in the Philippines has fallen 43% in fifteen years and the area planted has halved. Farmers here have never been shown whether their own land could still carry it.* | "Ambang among challenge nga Field Shift. Ang produksyon sa ube sa Pilipinas naa 43% nga pag-ubos sa 15 ka tuig, ug napuputol sa katapusan ang area nga gitanuman. Walay gipakita sa mga farmer kung pwede pa ba ang ilang uma nga ma-grow." |
| 0:05 to 0:10 | The UbiMap title screen and tagline | *UbiMap: can my field grow ube, which rotation fits it, and when do I plant?* | "UbiMap. Ma-grow ba nga ube ang imong uma? Unsang rotation ang fit sa imong uma? Kanus-a ang tamang panahon sa pagtani?" |
| 0:10 to 0:14 | The live NASA MODIS map of Pagadian, then tap **Check live with NASA POWER** and show the table that comes back | *Seven NASA datasets. MODIS and VIIRS imagery, SMAP soil moisture and GPM IMERG rainfall stream live from NASA into the browser. And this button calls NASA POWER right now, while you watch.* | "Pit ka dataset sa NASA. Ang MODIS ug VIIRS, ang SMAP soil moisture, ug ang GPM IMERG, live gikan sa NASA direkta sa browser. Ug niining button, naa tawag sa NASA POWER karong karong minsa." |
| 0:14 to 0:18 | The Farm Card: the 71 out of 100 score and the three reasons | *Every score names its dataset and its raw value. Nothing is invented, and missing soil data is shown as missing.* | "Kada numero adunay iyang dataset ug iyang value. Dili gipaka-invent ang mga numero, kung kulang ang datos, makita nga kulang." |
| 0:18 to 0:21 | Scroll the four rotation cards | *Four rotations, including the one you farm now, each with why it is suggested, the evidence, the benefits, the gaps and the risks.* | "Upat ka rotation, lahat gikan sa imong karon, kada usa adunay ngano, evidence, kaayo, gap, ug risk." |
| 0:21 to 0:25 | The validation table and the rainfall cross-check | *We tested the model against Philippine Statistics Authority data. The first version scored nothing against real yield, so we rebuilt the rainfall from GPM IMERG at 10 km instead of POWER at 50 km. Same provinces: the correlation with real yield went from zero to plus 0.32, and with production volume to plus 0.48. Checked against the weather station, the finer product is right to within a third of a percent.* | "Gi-test nami ang modelo sa datos sa PSA. Ang una nga bersyon wala gyud, so gibuild nami ang ulan gikan sa GPM IMERG sa 10 km imbis sa POWER sa 50 km. Pareho pa na ka probinsiya: ang correlation sa aktuwal nga yield adlaw gikan sa zero to plus 0.32, ug sa volume to plus 0.48." |
| 0:25 to 0:30 | The map, then the team names | *One node per barangay, ground truth against the satellite, and a province map that shows where local ube supply could grow instead of being imported. This tool supports the farmer, it does not replace them.* | "Usa ka node kada barangay, ground truth kontra satellite, ug mapa sa probinsiya nga magpapakita asa makatubu ang local supply imbis naa i-import. Ginatabang niini ang farmer, dili gi-replace." |

**Cut list if you are running long.** Drop the rotation cards shot and the validation shot
to 1.5 seconds each. The three shots that must survive are the live NASA map, the Farm
Card, and the validation table, because those three are what no other team is doing.

**Recording checklist**

- [ ] English subtitles burned in on every spoken line.
- [ ] Exactly 30 seconds or less. Check the length of the exported file, not the edit
      timeline.
- [ ] The NASA map is visibly live (the image date reads 2026-11-14 or later).
- [ ] No password, no login, no registration needed to watch it.
- [ ] Upload it somewhere public: YouTube unlisted, Google Drive with "anyone with the
      link", OneDrive, Dropbox.
- [ ] Test the link in a private window before you paste it into the form.

---

# Option B: the 7 slide deck

**The deck is already built and hosted.** Seven slides, English, with the team name, the four
member names and the challenge on the title slide. Paste this link into the demo field:

> `https://ubimap.pages.dev/ubimap-deck.pdf`

Mirror: `https://zhameersheraz.github.io/ubimap/ubimap-deck.pdf`

The source is `deck/index.html`. To change a word, edit that file, then run:

```
node scripts/shoot_screenshots.mjs http://localhost:8080 deck/shots
python scripts/build_deck.py
```

The script `scripts/build_deck.py` prints the PDF to `deck/ubimap-deck.pdf` and copies it to
`public/ubimap-deck.pdf`, which the Vite build publishes. The screenshots in `deck/shots/`
are real captures of the running app, taken by `scripts/shoot_screenshots.mjs` through the
Chrome DevTools Protocol, so nothing in the deck is a mock up.

Below is the outline the deck follows, for reference.

Must contain the team name, the names of the team members, and the challenge selected.
English only.

### Slide 1 - Title

> **UbiMap**
> Satellite-guided ube rotation planning for Filipino farmers
> Team Messiah Project Digital · Mark John Riel Alforque (Team Owner), Zhameer Sheraz Tampugao, Cathy Untolan, Jerenze Levi Omandam
> NASA Space Apps Hackathon 2026 · Field Shift: Adapting Farms with NASA Data
> *(one line of hero art: the MODIS true colour image of the Zamboanga peninsula)*

### Slide 2 - The problem

> **Ube is being abandoned, not failing**
> - Philippine production fell 43%: 21,906 MT (2010) to 12,483 MT (2025), PSA
> - Area harvested halved: 4,744 ha to 2,367 ha. Yield went up.
> - Bohol, the heartland, fell 70%.
> - We checked the premise: the Philippines is a **net exporter** of ube by roughly 30 to
>   1. Only 54 tonnes of frozen ube come in, almost all from Vietnam. Taiwan and China
>   are not suppliers. The real constraint is domestic planting material.
> - Most upland farmers here farm corn after corn, or cassava alone.

### Slide 3 - What UbiMap does

> **One question, one page**
> Pin your field → choose your crop and your priorities → get a Farm Card
> - Ube readiness score out of 100, with the reasons and the concerns
> - Four rotations compared, including the one you farm now
> - A planting calendar from your local rainfall
> - Bisaya, Filipino and English, on a basic phone, works offline
> *(screenshot: the Farm Card)*

### Slide 4 - The NASA data

> **Seven NASA datasets, live and precomputed**
> - NASA POWER: rainfall, temperature, soil wetness, 2015 to 2024
> - NASA SRTM: elevation and slope at 30 m
> - NASA GIBS live in the browser: MODIS and VIIRS true colour and NDVI, SMAP soil
>   moisture, GPM IMERG rainfall, MODIS and VIIRS flood extent
> - NASA CMR for provenance
> *(screenshot: the map with the layer chips visible)*

### Slide 5 - The model, and what it will not do

> **Explainable on purpose**
> - Six factors, weighted by AHP, consistency ratio 0.034 against a 0.10 limit
> - Named rules, not a black box, so an extension worker can argue with them
> - Every number shows its dataset and its raw value
> - Missing soil data is shown as missing, never filled in
> - **It does not predict yield.** It screens land for a conversation with a farmer.

### Slide 6 - The validation, including the failure

> **We tested it against real Philippine statistics**
> - 110 points, 18 ube producing provinces and 4 without, against PSA 2025
> - The model puts the non producing provinces at the bottom. Good.
> - The first version of the model had r = +0.00 against real yield. We report that too.
> - Why: the rainfall. NASA POWER smooths the dry season away at 50 km.
> - So we rebuilt the rain from GPM IMERG at 10 km, 9,124 daily NASA GIBS tiles.
> - Same 18 provinces: yield r = +0.00 becomes +0.32, volume r = +0.21 becomes +0.48.
> - Checked against the PAGASA station: IMERG within 0.3%, POWER 7% low.
> - r = +0.32 is a real signal and a modest one. Screening tool, not a yield predictor.
> - Left open: the nearest representative weather station is 110 km away.
>   No station at Pagadian. That gap is what a sensor would close.

### Slide 7 - The future

> **One node per barangay**
> - ESP32 field sensor, firmware written and ready to flash, roughly PHP 1,000 to 1,500
> - Ground truth at the scale the farmer actually works, checked against the satellite
> - A province map that shows where local ube supply could grow instead of being imported
> - **This tool supports the farmer. It does not replace them, and it does not replace the
>   local agriculturist.**
> - Live demo: https://ubimap.pages.dev · Code: https://github.com/zhameersheraz/ubimap

---

## Screenshots worth taking for the project page

The submission page accepts images up to 10 MB each. Take these four at a wide viewport
so the text is readable:

1. The map with the MODIS true colour layer on and the suitability heatmap visible, with
   the layer chips in frame. This is the one that proves the NASA data is live.
2. The Farm Card: the score gauge, the reasons with their dataset chips, and the
   confidence note.
3. The rotation cards, scrolled so one card shows all five required elements: why,
   evidence, benefits, gaps, risks.
4. The validation table with the honest paragraph underneath it. This is the slide that
   separates a team that tested something from a team that did not.

For the project page itself, put the screenshots inline where they support the text
rather than in one block at the end.
