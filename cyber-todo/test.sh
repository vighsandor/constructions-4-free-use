#!/bin/bash
# CYBER-TODO v1.2.0 Teszt Script
# Használat: ./test.sh

API_URL="http://localhost/todo/api.php"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "==================================="
echo "  CYBER-TODO API Tesztek"
echo "==================================="
echo ""

# Test counter
PASSED=0
FAILED=0

test_api() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=${4:-}
    
    echo -n "Testing: $name ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s "$url")
    else
        response=$(curl -s -X "$method" -H "Content-Type: application/json" -d "$data" "$url")
    fi
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "  Response: $response"
        ((FAILED++))
        return 1
    fi
}

# 1. API elérhetőség
echo "1. Alapvető tesztek"
echo "-------------------"
test_api "API elérhetőség" "$API_URL?action=getTasks"

# 2. Új feladat hozzáadása
echo ""
echo "2. Feladat műveletek"
echo "--------------------"
test_api "Új feladat létrehozása" \
    "$API_URL?action=addTask" \
    "POST" \
    '{"text":"Teszt feladat","priority":"high","category":"work"}'

# 3. Feladatok lekérése
test_api "Feladatok lekérése" "$API_URL?action=getTasks"

# 4. Feladat szerkesztése (need ID from previous)
echo ""
echo "3. Szerkesztés tesztek"
echo "----------------------"
TASK_ID=$(curl -s "$API_URL?action=getTasks" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$TASK_ID" ]; then
    test_api "Feladat szerkesztése" \
        "$API_URL?action=updateTask" \
        "POST" \
        "{\"id\":\"$TASK_ID\",\"text\":\"Módosított teszt feladat\"}"
    
    # 5. Feladat teljesítése
    test_api "Feladat teljesítése" \
        "$API_URL?action=toggleTask" \
        "POST" \
        "{\"id\":\"$TASK_ID\"}"
    
    # 6. Feladat visszaállítása
    test_api "Feladat visszaállítása" \
        "$API_URL?action=toggleTask" \
        "POST" \
        "{\"id\":\"$TASK_ID\"}"
    
    # 7. Feladat törlése
    test_api "Feladat törlése" \
        "$API_URL?action=deleteTask" \
        "POST" \
        "{\"id\":\"$TASK_ID\"}"
else
    echo -e "${RED}Nincs feladat ID a teszthez${NC}"
    ((FAILED++))
fi

# 8. Telegram beállítások
echo ""
echo "4. Telegram tesztek"
echo "-------------------"
test_api "Telegram beállítások lekérése" "$API_URL?action=getTelegram"

test_api "Telegram beállítások mentése" \
    "$API_URL?action=saveTelegram" \
    "POST" \
    '{"enabled":false,"botToken":"","chatId":"","onAdd":true,"onComplete":true,"onDelete":false,"onOverdue":true}'

# Összesítés
echo ""
echo "==================================="
echo "  Eredmények"
echo "==================================="
echo -e "  ${GREEN}Sikeres: $PASSED${NC}"
echo -e "  ${RED}Sikertelen: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}Minden teszt sikeres!${NC}"
    exit 0
else
    echo -e "${RED}Néhány teszt sikertelen!${NC}"
    exit 1
fi
