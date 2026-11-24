# Space Invaders Online

Versio preparada per publicar el joc i el seu servidor amb GitHub i Render. El servidor inclou comptes amb contrasenyes xifrades, desat de perfil a PostgreSQL, rànquings i partides multijugador d'Invaders i Pong.

## Publicar amb GitHub i Render

1. Crea un repositori nou a GitHub.
2. Puja-hi tots els fitxers d'aquesta carpeta, mantenint `render.yaml` a l'arrel. Es pot fer amb Git o amb l'opcio de pujar fitxers de GitHub.
3. A Render, tria **New + → Blueprint** i connecta el repositori.
4. Render llegira `render.yaml` i configurara el servidor web, PostgreSQL, `DATABASE_URL` i un `JWT_SECRET` aleatori. Confirma la creacio dels serveis.
5. Quan el desplegament acabi, obre l'adreca `https://...onrender.com` que mostra Render. El joc i l'API comparteixen el mateix domini.

No cal canviar cap URL al codi ni configurar ngrok o CORS. El servidor desa les dades dels comptes a PostgreSQL, no al disc temporal del servei web.

## Executar localment

Cal Node.js 20 o superior i una base de dades PostgreSQL. Des de la carpeta del projecte:

```powershell
npm install
$env:DATABASE_URL = "postgresql://usuari:contrasenya@localhost:5432/space_invaders"
$env:JWT_SECRET = "posa-aqui-una-clau-llarga-i-aleatoria"
npm start
```

Obre `http://localhost:10000`. La taula de jugadors es crea automàticament al primer inici.

## Notes

- Les contrasenyes s'emmagatzemen amb hash bcrypt; el servidor crea sessions signades i comprova la identitat en les crides a l'API i als WebSockets.
- Els serveis gratuïts de Render poden tenir limitacions, aturar-se per inactivitat o estar subjectes a expiració. Comprova els plans i la retenció de PostgreSQL al teu compte de Render abans d'usar-lo per conservar comptes a llarg termini.
- El registre nou requereix una contrasenya de 8 caràcters com a mínim.

## Funcions del joc

- Xat global en temps real al menú, amb reaccions ràpides i avisos de rècords i partides noves.
- Economia: 7 monedes per onada completada i 18 monedes per guanyar un duel en línia. Les compres i les recompenses s'actualitzen al servidor.
- Botiga retro amb vuit naus, habilitats diferents i una botiga de colors per a Pong. Als duels d'Invaders, els dos jugadors utilitzen la nau clàssica.
- Mode espectador de Pong: es poden veure les partides en directe, però els espectadors no poden moure les pales.
- Panell d'administració exclusiu del compte `URIF753`, amb llista de jugadors connectats i reinici de monedes.
