# CYBER-TODO v1.2.1

Neon dark cyber stílusú, szerver-alapú TODO alkalmazás — PHP backenddel és Telegram értesítés integrációval.

> **Fontos:** Ez a verzió JSON alapú adattárolást használ, így minden böngészőből ugyanazt az adatot látod. A `todo.json` fájl a szerveren tárolódik.

---

## Újdonságok a v1.2.1 verzióban

- **Automatikus függőség telepítés** — Az install script automatikusan telepíti a hiányzó komponenseket (Apache2, PHP, cURL)
- **Javított Telegram teszt** — cURL alapú megbízhatóbb üzenetküldés
- **Részletes telepítési napló** — Színes kimenet és állapotjelzés
- **Nincsenek demo feladatok** — Üresen induló alkalmazás
- **Részletes hibakezelés** — Konkrét hibaüzenetek a Telegram API válaszokhoz

---

## Gyors telepítés (5 perc)

### Automatikus telepítés (ajánlott)

```bash
# 1. Telepítő script futtatása
sudo ./install.sh

# 2. Böngészőből megnyitás
# http://localhost/todo/index.html
```

A telepítő automatikusan:
- Ellenőrzi a rendszerkövetelményeket
- Telepíti a hiányzó függőségeket (Apache2, PHP, cURL)
- Beállítja a jogosultságokat
- Konfigurálja az Apache-ot

### Manuális telepítés

#### 1. Rendszerkövetelmények ellenőrzése

```bash
# Ellenőrzés
php -v              # PHP 7.4+ szükséges
php -m | grep curl  # cURL modul szükséges
apache2 -v          # Apache2 szükséges
```

#### 2. Hiányzó függőségek telepítése

```bash
# Frissítés
sudo apt-get update

# Apache2 és PHP telepítése
sudo apt-get install -y apache2 php libapache2-mod-php

# PHP cURL modul (kötelező a Telegram API-hoz)
sudo apt-get install -y php-curl

# További hasznos modulok
sudo apt-get install -y php-json php-mbstring

# Apache modulok engedélyezése
sudo a2enmod rewrite
sudo a2enmod headers

# Apache újraindítása
sudo systemctl restart apache2
```

#### 3. Fájlok elhelyezése

```bash
# Fájlok másolása
sudo cp -r todo_1week/* /var/www/html/todo/

# Jogosultságok beállítása
sudo chown -R www-data:www-data /var/www/html/todo/
sudo chmod 664 /var/www/html/todo/todo.json
sudo chmod 755 /var/www/html/todo/api.php
sudo chmod 755 /var/www/html/todo/backup.sh
sudo chmod 644 /var/www/html/todo/index.html
sudo chmod 644 /var/www/html/todo/style.css
sudo chmod 644 /var/www/html/todo/app.js
sudo chmod 644 /var/www/html/todo/.htaccess
sudo chmod 750 /var/www/html/todo/backups
```

#### 4. Apache konfiguráció ellenőrzése

```bash
# .htaccess engedélyezése
sudo nano /etc/apache2/apache2.conf
# Ellenőrizd: <Directory /var/www/html> AllowOverride All </Directory>

# Apache újraindítása
sudo systemctl restart apache2
```

#### 5. Megnyitás böngészőből

```
http://localhost/todo/index.html
```

---

## Funkciók

### Feladatkezelés
- Feladatok hozzáadása, szerkesztése, törlése
- **Prioritások:** Alacsony / Közepes / Magas (neon szín + glow jelzéssel)
- **Kategóriák:** Személyes, Munka, Bevásárlás, Egészség, Egyéb
- Határidő beállítása — lejárt feladatok villogó jelzéssel
- Megjegyzések a feladatokhoz
- Drag & drop sorrendezés

### Szűrés és keresés
- Szöveges keresés (feladat szövege + megjegyzés)
- Státusz szűrés: Összes / Aktív / Kész
- Kategória szűrés
- Rendezés: létrehozás ideje, prioritás, határidő, ABC

### Statisztikák
- Összes / aktív / kész / lejárt feladatok száma valós időben

### Telegram értesítések
- Bot Token + Chat ID konfiguráció (todo.json-ben tárolva)
- Eseményenkénti engedélyezés: hozzáadás, teljesítés, törlés, lejárt feladatok
- Napi összesítő a lejárt feladatokról
- Teszt üzenet küldés a beállítások ellenőrzéséhez

### Design — Neon Dark Cyber
- JetBrains Mono monospace tipográfia
- Scanline háttéreffekt
- Neon glow animációk (cyan, magenta, green, amber, red)
- Cyber panel design sarkokkal és top line dekorációval
- Reszponzív elrendezés (mobil kompatibilis)

---

## API Endpointok

Az `api.php` a következő REST API endpointokat biztosítja:

| Action | Method | Leírás |
|--------|--------|--------|
| `getTasks` | GET | Összes feladat lekérése |
| `addTask` | POST | Új feladat hozzáadása |
| `toggleTask` | POST | Feladat teljesített/aktív állapot váltása |
| `updateTask` | POST/PUT | Feladat szerkesztése |
| `deleteTask` | POST/DELETE | Feladat törlése |
| `reorderTasks` | POST | Feladatok sorrendjének módosítása |
| `getTelegram` | GET | Telegram beállítások lekérése |
| `saveTelegram` | POST | Telegram beállítások mentése |
| `testTelegram` | POST | Telegram teszt üzenet küldése (cURL vagy fallback) |

### Példa API hívásokra

```bash
# Összes feladat lekérése
curl "http://localhost/todo/api.php?action=getTasks"

# Új feladat hozzáadása
curl -X POST "http://localhost/todo/api.php?action=addTask" \
  -H "Content-Type: application/json" \
  -d '{"text":"Új feladat","priority":"high","category":"work"}'

# Feladat teljesítése
curl -X POST "http://localhost/todo/api.php?action=toggleTask" \
  -H "Content-Type: application/json" \
  -d '{"id":"abc123"}'

# Telegram teszt
curl -X POST "http://localhost/todo/api.php?action=testTelegram" \
  -H "Content-Type: application/json" \
  -d '{"botToken":"123456:ABCdef","chatId":"123456789"}'
```

---

## Adatstruktúra (todo.json)

```json
{
  "tasks": [
    {
      "id": "abc123def456",
      "text": "Feladat szövege",
      "completed": false,
      "priority": "high",
      "category": "work",
      "dueDate": "2025-07-15",
      "notes": "Részletek...",
      "createdAt": 1720000000000,
      "completedAt": null
    }
  ],
  "telegram": {
    "enabled": false,
    "botToken": "",
    "chatId": "",
    "onAdd": true,
    "onComplete": true,
    "onDelete": false,
    "onOverdue": true
  },
  "version": "1.2.1"
}
```

---

## Telegram értesítés beállítása

### 1. lépés — Bot létrehozása

1. Nyisd meg a [@BotFather](https://t.me/BotFather) chattet Telegramon
2. Küldj `/newbot` parancsot
3. Add meg a bot nevét és felhasználónevét (pl. `MyCyberTodoBot`)
4. Másold ki a kapott **Bot Token**-t (pl. `123456789:ABCdefGhIJKlmNoPQRsTUVwXyz`)

### 2. lépés — Chat ID megszerzése

**Privát üzenet esetén:**
1. Küldj egy üzenetet a botodnak
2. Nyisd meg böngészőben: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. A válaszban keresd a `"chat":{"id": ...}` mezőt (pozitív szám)

**Csoport esetén:**
1. Add hozzá a botot a csoporthoz adminként
2. Küldj egy üzenetet a csoportban
3. Azonos URL-en ellenőrizd az ID-t (negatív szám, pl. `-1001234567890`)

**Egyszerűbb alternatíva:**
- Küldj `/start` parancsot a botnak, majd nyisd meg: `https://api.telegram.org/bot<TOKEN>/getUpdates`

### 3. lépés — Konfigurálás az alkalmazásban

1. Kattints az **⚡** gombra a fejlécben
2. Kapcsold be az **ÉRTESÍTÉSEK ENGEDÉLYEZÉSE** kapcsolót
3. Illeszd be a **Bot Token**-t
4. Illeszd be a **Chat ID**-t
5. Válaszd ki a kívánt értesítési eseményeket
6. Kattints a **⚡ TESZT ÜZENET** gombra az ellenőrzéshez
7. Kattints a **MENTÉS** gombra

> **Biztonsági megjegyzés:** A Bot Token a `todo.json` fájlban tárolódik a szerveren. Csak megbízható szerveren használd!

---

## Biztonsági javaslatok

### 1. JSON fájlok védelme

A `.htaccess` fájl már tartalmazza a JSON fájlok védelmét:

```apache
<FilesMatch "\.(json|tar\.gz)$">
    Require all denied
</FilesMatch>
```

Ez megakadályozza, hogy a `todo.json` és a backup fájlok közvetlenül letölthetők legyenek.

### 2. Backup könyvtár védelme

```bash
# Backup könyvtár jogosultságai
sudo chmod 750 /var/www/html/todo/backups
sudo chown www-data:www-data /var/www/html/todo/backups
```

### 3. API végpont védelme (opcionális)

Ha jelszavas védelmet szeretnél az API-ra:

```php
// api.php elejére
$VALID_PASSWORD = 'titkos_jelszo';
if ($_SERVER['PHP_AUTH_USER'] !== 'admin' || $_SERVER['PHP_AUTH_PW'] !== $VALID_PASSWORD) {
    header('WWW-Authenticate: Basic realm="CYBER-TODO API"');
    header('HTTP/1.0 401 Unauthorized');
    echo json_encode(['error' => 'Hitelesítés szükséges']);
    exit;
}
```

### 4. HTTPS használata

Éles környezetben mindig használj HTTPS-t:

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d your-domain.com
```

---

## Hibaelhárítás

### Függőségek ellenőrzése

```bash
# PHP verzió
php -v

# cURL modul
php -m | grep curl

# Apache státusz
systemctl status apache2

# PHP betöltve Apache-ba?
apache2ctl -M | grep php
```

### 404 hibák az API hívásoknál

**Hiba:** `GET/POST/PUT/DELETE http://.../api.php?action=xxx [HTTP/1.1 404 Not Found]`

**Megoldások:**

1. **Ellenőrizd az api.php elérhetőségét:**
   ```bash
   curl http://localhost/todo/api.php?action=getTasks
   ```
   Ha 404-et kapsz, nincs jó helyen a fájl.

2. **PHP modul nincs betöltve:**
   ```bash
   sudo a2enmod php8.1  # vagy php7.4, php8.2, php8.3 stb.
   sudo systemctl restart apache2
   ```

3. **Apache error log:**
   ```bash
   sudo tail -f /var/log/apache2/error.log
   ```

### Nem frissül az oldal változtatás után

**Megoldás:**

1. **Hard refresh:** `Ctrl+F5` vagy `Ctrl+Shift+R`

2. **Cache tisztítása a böngészőben:**
   - Chrome/Firefox: `Ctrl+Shift+Delete`

3. **Fejlesztői eszközökben cache tiltása:**
   - F12 → Network tab → "Disable cache" bepipálva

### "Nem sikerült betölteni a feladatokat"

1. Ellenőrizd a böngésző konzolját (F12)
2. Nézd meg az Apache error logot
3. Ellenőrizd a `todo.json` létezését:
   ```bash
   ls -la /var/www/html/todo/todo.json
   ```

### "Nem tudok feladatot menteni"

1. **Jogosultságok ellenőrzése:**
   ```bash
   ls -la /var/www/html/todo/todo.json
   # www-data kell legyen a tulajdonos
   ```

2. **Jogosultság javítása:**
   ```bash
   sudo chown www-data:www-data /var/www/html/todo/todo.json
   sudo chmod 664 /var/www/html/todo/todo.json
   ```

3. **Lock fájl törlése (ha maradt):**
   ```bash
   sudo rm -f /var/www/html/todo/todo.json.lock
   ```

4. **Nézd meg a webserver error logját:**
   ```bash
   sudo tail -f /var/log/apache2/error.log
   ```

### Telegram nem küld értesítést

1. Ellenőrizd a Bot Token és Chat ID helyességét
2. Használd a **TESZT ÜZENET** gombot
3. Nézd meg a szerver error logját
4. **cURL telepítve van?**
   ```bash
   php -m | grep curl
   # Ha nincs: sudo apt-get install php-curl
   ```

### 500 Internal Server Error (Telegram teszt)

```bash
# cURL modul ellenőrzése
php -m | grep curl

# Ha hiányzik, telepítsd:
sudo apt-get install php-curl
sudo systemctl restart apache2

# Error log ellenőrzése
sudo tail -f /var/log/apache2/error.log
```

### Adatbázis zárolva hiba

```bash
# Lock fájl törlése
sudo rm -f /var/www/html/todo/todo.json.lock
```

---

## Fájlok és segédeszközök

### Fő fájlok

| Fájl | Leírás |
|------|--------|
| `index.html` | Alkalmazás HTML struktúra + modalok |
| `style.css` | Neon dark cyber dizájn rendszer |
| `app.js` | Alkalmazás logika + API hívások |
| `api.php` | REST API endpointok (PHP backend) |
| `todo.json` | Adattárolás (feladatok + beállítások) |
| `.htaccess` | Apache konfiguráció (védelem, cache, rewrite) |

### Segédszkriptek

| Szkript | Leírás |
|---------|--------|
| `install.sh` | Automatikus telepítő script |
| `backup.sh` | Biztonsági mentés készítése |
| `test.sh` | API tesztek futtatása |

### Hasznos parancsok

```bash
# Telepítés
sudo ./install.sh

# Tesztelés
sudo ./test.sh

# Backup készítése
sudo ./backup.sh

# Logok nézése
sudo tail -f /var/log/apache2/error.log

# Jogosultságok ellenőrzése
ls -la /var/www/html/todo/
```

---

## Verziónapló

### v1.2.1 (2025-07-01)
- **Automatikus függőség telepítés** — install script felismeri és telepíti a hiányzó komponenseket
- **Javított Telegram teszt** — cURL alapú megbízhatóbb üzenetküldés fallback lehetőséggel
- **Részletes telepítési napló** — Színes kimenet, állapotjelzés, függőségellenőrzés
- **Nincsenek demo feladatok** — Üresen induló alkalmazás
- **500 hiba javítás** — cURL modul hiánya esetén fallback file_get_contents módszer
- Verzió frissítés mindenhol (HTML, JS, CSS, JSON, API)

### v1.2.0 (2025-07-01)
- **JSON alapú adattárolás** — todo.json fájl a feladatoknak és beállításoknak
- **PHP backend** — api.php REST API endpointokkal
- **Többfelhasználós támogatás** — ugyanaz az adat minden böngészőből elérhető
- **Lock mechanizmus** — egyidejű írási műveletek védelme
- **Async/await refaktor** — minden API hívás aszinkron
- **Automatikus backup** — minden írási művelet előtt biztonsági másolat
- **README bővítés** — telepítési útmutató, API dokumentáció, hibaelhárítás

### v1.1.0
- Neon dark cyber redesign (teljes CSS újraírás)
- JetBrains Mono monospace tipográfia
- Scanline + neon glow effektek
- Telegram Bot értesítés integráció
- Telegram beállítások modal (token, chatId, eseménykapcsolók, tesztelés)
- Napi lejárt feladat összesítő Telegramon
- Header gomb állapot jelzése (aktív Telegram esetén kiemelve)
- Verzió badge a fejlécben
- README dokumentáció

### v1.0.0
- Alap TODO funkciók (CRUD)
- Light / dark téma
- Szűrés, keresés, rendezés
- Drag & drop
- Prioritás, kategória, határidő
- Toast értesítések
- Demo adatok

---

## License

Ez a projekt nyílt forráskódú, szabadon használható és módosítható.

---

**Készítette:** Vigh Sandor  
**Verzió:** 1.2.1  
**Dátum:** 2025-07-01  
**Követelmények:** Apache2, PHP 7.4+, PHP cURL
