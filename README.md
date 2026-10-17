# blooket-raid

One-page raid UI + node API for Render / any Node host.

## local
```
cd blooket-raid
node server.js
# http://localhost:3000
```

## render.com
1. New Web Service → this folder or github repo
2. Start command: `npm start`
3. Free instance → deploy
4. Open the onrender URL → pin → START RAID

## real joins
Edit `joinOnce` in server.js. Until you do, UI says ok but lobby stays empty.

## API
POST /raid  { "pin", "name", "count" }
GET  /raid/:id
POST /raid/:id/stop
