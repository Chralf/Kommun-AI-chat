# Kommun AI Chat - Chrome Extension

En konfigurerbar Chrome-extension som lägger till en AI-chatt sidebar för kommuner. Extensionen är kompatibel med OpenAI-kompatibla API:er och kan konfigureras för vilken server, modell och webbplatser som helst.

## Funktioner

- **Konfigurerbar** - Ange din egen API-server, nyckel och modell
- **Flexibel** - Fungerar på valfria domäner som du konfigurerar
- **Streaming** - Svar växer fram gradvis för bättre användarupplevelse
- **Markdown-stöd** - Rubriker, listor, länkar och formatering
- **Persistent** - Sidebar stannar synlig mellan sidladdningar
- **Chatthistorik** - Alla konversationer sparas lokalt

## Installation

1. Öppna Chrome och gå till `chrome://extensions/`
2. Aktivera "Utvecklarläge" (Developer mode)
3. Klicka på "Läs in opaketerat tillägg" (Load unpacked)
4. Välj mappen `Kundcenter plugin`

## Konfiguration

### Första gången:

1. **Öppna inställningarna:** klicka på `Inställningar` längst upp i sidebaren eller gå via `chrome://extensions/` → `Kommun AI Chat` → `Utvidgade inställningar`.
2. **Fyll i inställningarna:**
   - **API Server URL**: URL till din OpenAI-kompatibla API-server (t.ex. `https://api.example.com`)
   - **API-nyckel**: Din personliga API-nyckel från din AI-server
   - **Modellnamn**: Namnet på modellen i din AI-server (t.ex. `gpt-4`)
   - **Tillåtna domäner**: Domäner där extensionen ska fungera (en per rad, t.ex. `www.kommun.se`)
3. **Klicka på "Testa anslutning"** för att verifiera att inställningarna fungerar
4. **Klicka på "Spara inställningar"**
5. **Ladda om sidan** där du vill använda extensionen

## Användning

1. **Gå till en konfigurerad domän** (t.ex. https://www.kommun.se)
2. **Klicka på extension-ikonen** (AK) i toolbar för att visa eller dölja sidebaren
3. **Ställ frågor** i textfältet
4. **AI:n svarar** baserat på sidans innehåll

### Genvägar:

- **Enter**: Skicka fråga
- **Ctrl/Cmd+Enter**: Ny rad i fråga

## Filstruktur

```
Kundcenter plugin/
├── manifest.json      # Extension-konfiguration
├── content.js         # Huvudlogik för sidebar
├── sidebar.css        # Styling
├── background.js      # Service worker
├── settings.html      # Inställningssida
├── settings.js        # Inställningslogik
└── icons/            # Extension-ikoner
```

## Avancerad konfiguration

### Tillåta flera domäner:

I inställningssidan, ange domäner på separata rader:

```
www.kommun.se
minasidor.kommun.se
example.com
```

Extensionen fungerar då på:
- `https://www.kommun.se/*`
- `https://kommun.se/*`
- `https://minasidor.kommun.se/*`
- `https://example.com/*`
- etc.

### Byta API-server:

Om du vill använda en annan OpenAI-kompatibel API-server:
1. Öppna inställningssidan
2. Ändra **API Server URL**
3. Ange rätt **API-nyckel** och **Modellnamn**
4. Klicka på **"Testa anslutning"** för att verifiera
5. Spara inställningar

## Markdown-formatering

AI:n kan använda Markdown i sina svar:

- `### Rubrik` → Formaterad rubrik
- `**fet text**` → **fet text**
- `*kursiv*` → *kursiv*
- `[länk](url)` → Klickbar länk
- `- listpunkt` → Punktlista

## Säkerhet

- API-nyckel sparas krypterat av Chrome i `chrome.storage.local` och levereras inte med extensionen
- Endast HTTPS-URL:er accepteras för API-servern
- Länkar i AI-svar saneras och begränsas till http(s)
- Chatthistorik och siddata sparas endast lokalt i webbläsaren
- Ingen data skickas till externa servrar utöver din konfigurerade API-server

## Felsökning

### Sidebar visas inte:

1. **Kontrollera att du är på en tillåten domän**
2. **Öppna Console** (F12) och sök efter "Kommun AI Chat"
3. **Kontrollera inställningarna** - klicka på extension-ikonen
4. **Ladda om extensionen** i `chrome://extensions/`

### API-fel:

1. **Kontrollera API-nyckel** - är den korrekt?
2. **Använd "Testa anslutning"-knappen** i inställningarna för att verifiera
3. **Kontrollera modellnamn** - finns modellen i din AI-server?
4. **Kontrollera API Server URL** - måste börja med `https://`

### Console-meddelanden:

Öppna Console (F12) för att se debug-information:
- "Config loaded" - Konfiguration laddad
- "Domän tillåten" - Extensionen fungerar på denna sida
- "Domän inte tillåten" - Lägg till domänen i inställningarna

## Version 1.0.0

### Funktioner:
- Dynamisk script-injektion endast på tillåtna domäner
- Inställningssida som kräver egen API-nyckel (ingen hårdkodad nyckel)
- HTTPS-validering och domänsanering i formuläret
- Sanitiserad Markdown-rendering i sidebaren
- Förbättrat säkerhetsflöde vid toggling och laddning av sidor
- AI-chatt med streaming-svar
- Chatthistorik och session-hantering
- Stöd för flera AI-konfigurationer

## Licens

Detta projekt är licensierad under [MIT License](LICENSE) - se LICENSE-filen för detaljer.

Du är fri att använda, modifiera och distribuera detta projekt enligt licensvillkoren.
