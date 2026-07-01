#!/bin/bash
# CYBER-TODO v1.2.1 Telepítő Script
# Használat: sudo ./install.sh

echo "==================================="
echo "  CYBER-TODO v1.2.1 Telepítő"
echo "==================================="
echo ""

# Színek
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Hiba kezelés
set -e

# Rendszerellenőrzés
echo -e "${BLUE}Rendszerellenőrzés...${NC}"

APACHE_INSTALLED=false
PHP_INSTALLED=false
CURL_INSTALLED=false

if command -v apache2 &> /dev/null; then
    APACHE_INSTALLED=true
    echo -e "  ${GREEN}✓${NC} Apache2 telepítve"
else
    echo -e "  ${RED}✗${NC} Apache2 nincs telepítve"
fi

if command -v php &> /dev/null; then
    PHP_INSTALLED=true
    PHP_VERSION=$(php -v | head -1)
    echo -e "  ${GREEN}✓${NC} PHP telepítve: $PHP_VERSION"
else
    echo -e "  ${RED}✗${NC} PHP nincs telepítve"
fi

if php -m | grep -qi curl; then
    CURL_INSTALLED=true
    echo -e "  ${GREEN}✓${NC} PHP cURL telepítve"
else
    echo -e "  ${RED}✗${NC} PHP cURL nincs telepítve"
fi

# Hiányzó komponensek telepítése
echo ""
MISSING=false
if [ "$APACHE_INSTALLED" = false ] || [ "$PHP_INSTALLED" = false ] || [ "$CURL_INSTALLED" = false ]; then
    MISSING=true
    echo -e "${YELLOW}Hiányzó komponensek észlelve.${NC}"
    read -p "Szeretnéd automatikusan telepíteni a hiányzó függőségeket? (i/n): " answer
    if [ "$answer" != "i" ]; then
        echo -e "${RED}Telepítés megszakítva${NC}"
        exit 1
    fi
fi

if [ "$MISSING" = true ]; then
    echo ""
    echo -e "${BLUE}Függőségek telepítése...${NC}"
    apt-get update -qq
    
    if [ "$APACHE_INSTALLED" = false ]; then
        echo -n "  Apache2 telepítése... "
        apt-get install -y -qq apache2 > /dev/null 2>&1
        echo -e "${GREEN}OK${NC}"
    fi
    
    if [ "$PHP_INSTALLED" = false ]; then
        echo -n "  PHP telepítése... "
        apt-get install -y -qq php libapache2-mod-php > /dev/null 2>&1
        echo -e "${GREEN}OK${NC}"
    fi
    
    if [ "$CURL_INSTALLED" = false ]; then
        echo -n "  PHP cURL telepítése... "
        apt-get install -y -qq php-curl > /dev/null 2>&1
        echo -e "${GREEN}OK${NC}"
    fi
    
    # További hasznos PHP modulok
    echo -n "  További PHP modulok... "
    apt-get install -y -qq php-json php-mbstring > /dev/null 2>&1
    echo -e "${GREEN}OK${NC}"
fi

# Apache modulok
echo ""
echo -e "${BLUE}Apache modulok engedélyezése...${NC}"
a2enmod rewrite > /dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} rewrite modul" || echo -e "  ${YELLOW}!${NC} rewrite már engedélyezve"
a2enmod headers > /dev/null 2>&1 && echo -e "  ${GREEN}✓${NC} headers modul" || echo -e "  ${YELLOW}!${NC} headers már engedélyezve"

# Könyvtár létrehozása
TARGET_DIR="/var/www/html/todo"
echo ""
echo -e "${BLUE}Célkönyvtár:${NC} $TARGET_DIR"
if [ ! -d "$TARGET_DIR" ]; then
    mkdir -p "$TARGET_DIR"
    echo -e "  ${GREEN}✓${NC} Létrehozva"
else
    echo -e "  ${YELLOW}!${NC} Már létezik"
fi

# Fájlok másolása
echo ""
echo -e "${BLUE}Fájlok másolása...${NC}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

copy_file() {
    if [ -f "$SCRIPT_DIR/$1" ]; then
        cp -v "$SCRIPT_DIR/$1" "$TARGET_DIR/" 2>/dev/null | sed 's/^/  /'
    fi
}

copy_file "index.html"
copy_file "style.css"
copy_file "app.js"
copy_file "api.php"
copy_file "todo.json"
copy_file ".htaccess"
copy_file "backup.sh"
copy_file "test.sh"

mkdir -p "$TARGET_DIR/backups"
echo -e "  ${GREEN}✓${NC} backups könyvtár létrehozva"

# Jogosultságok
echo ""
echo -e "${BLUE}Jogosultságok beállítása...${NC}"
chown -R www-data:www-data "$TARGET_DIR"
chmod 664 "$TARGET_DIR/todo.json"
chmod 755 "$TARGET_DIR/api.php"
chmod 755 "$TARGET_DIR/backup.sh"
chmod 755 "$TARGET_DIR/test.sh"
chmod 644 "$TARGET_DIR/index.html"
chmod 644 "$TARGET_DIR/style.css"
chmod 644 "$TARGET_DIR/app.js"
chmod 644 "$TARGET_DIR/.htaccess"
chmod 750 "$TARGET_DIR/backups"
echo -e "  ${GREEN}✓${NC} Minden jogosultság beállítva"

# Apache konfiguráció
echo ""
echo -e "${BLUE}Apache konfiguráció...${NC}"
if ! grep -q "AllowOverride All" /etc/apache2/apache2.conf 2>/dev/null; then
    echo -e "  ${YELLOW}!${NC} .htaccess engedélyezése..."
    sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf
    echo -e "  ${GREEN}✓${NC} Konfigurálva"
else
    echo -e "  ${GREEN}✓${NC} .htaccess már engedélyezve"
fi

# Apache újraindítása
echo ""
echo -e "${BLUE}Apache újraindítása...${NC}"
systemctl restart apache2
echo -e "  ${GREEN}✓${NC} Apache újraindítva"

# Végső ellenőrzés
echo ""
echo "==================================="
echo -e "${GREEN}Telepítés sikeres!${NC}"
echo "==================================="
echo ""
echo "Elérési út: $TARGET_DIR"
echo "Megnyitás: http://localhost/todo/index.html"
echo ""
echo "Fájlok:"
ls -la "$TARGET_DIR/" | grep -v "^total" | head -10
echo ""
echo "Hasznos parancsok:"
echo "  - Tesztelés:     $TARGET_DIR/test.sh"
echo "  - Backup:        $TARGET_DIR/backup.sh"
echo "  - Logok:         sudo tail -f /var/log/apache2/error.log"
echo ""
echo "Ha hibát látsz:"
echo "  1. Ellenőrizd a jogosultságokat: ls -la $TARGET_DIR/"
echo "  2. Nézd meg a logokat: sudo tail -f /var/log/apache2/error.log"
echo "  3. Futtasd a tesztet: $TARGET_DIR/test.sh"
echo ""
