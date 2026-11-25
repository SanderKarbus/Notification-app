# NotificationAPP-i demo testija

See on rakendusest eraldiseisev Playwrighti testikomplekt. Testid kasutavad
kontrollitud API-vastuseid, seega ei sõltu tulemus Mulgi valla ega
Kultuurikava serveri hetkeolekust.

## Eeldused

- Node.js 18 või uuem
- projekti juurkaustas olev `server.js`

## Paigaldus ja käivitamine

Käivita PowerShellis:

```powershell
cd "Demo testija"
npm install
npx playwright install
npm test
```

HTML-raporti avamine:

```powershell
npm run report
```

## Kaetud stsenaariumid

- avalehe, teadete ja sündmuste laadimine
- teate ja sündmuse detailvaade
- tühi sisu ja API vead
- aegunud sisu eraldamine aktiivsest vaatest
- filtrid, tume kujundus ja localStorage-põhine olek
- märguannete lülitamine ja rakenduse uuesti avamine
- meeldetuletuse demo-teavitus
- aeglane internet ja interneti puudumine
- Chromiumi töölauavaade ning Androidi/iOS-i emulatsiooniprofiilid
