#!/bin/bash
# CYBER-TODO Backup Script
# Automatikus biztonsági mentés

BACKUP_DIR="/var/www/html/todo/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
SOURCE_DIR="/var/www/html/todo"

echo "=== CYBER-TODO Backup ==="
echo "Dátum: $DATE"

if [ ! -d "$BACKUP_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    echo "Létrehozva: $BACKUP_DIR"
fi

tar -czf "$BACKUP_DIR/full_backup_$DATE.tar.gz" \
    --exclude='backups/*.tar.gz' \
    -C "$SOURCE_DIR" .

if [ $? -eq 0 ]; then
    echo "✓ Sikeres mentés: $BACKUP_DIR/full_backup_$DATE.tar.gz"
else
    echo "✕ Hiba a mentés során!"
    exit 1
fi

# Régi mentések takarítása (10-nél régebbi)
cd "$BACKUP_DIR"
ls -t full_backup_*.tar.gz | tail -n +11 | xargs -r rm
echo "✓ Régi mentések takarítva"

echo "=== Kész ==="
