# CYBER-TODO Backup és Restore

## Automatikus Backup

### 1. Script telepítése

```bash
# Másold a backup.sh-t a szerverre
sudo cp backup.sh /usr/local/bin/cyber-todo-backup
sudo chmod +x /usr/local/bin/cyber-todo-backup
```

### 2. Cron job beállítása (napi mentés)

```bash
sudo crontab -e
# Add hozzá:
0 2 * * * /usr/local/bin/cyber-todo-backup >> /var/log/cyber-todo-backup.log 2>&1
```

### 3. Kézi mentés

```bash
sudo /usr/local/bin/cyber-todo-backup
```

## Restore

### Teljes visszaállítás backupból

```bash
# Lista a mentésekről
ls -la /var/www/html/todo/backups/

# Visszaállítás (cseréld le a dátumot)
cd /var/www/html/todo
sudo tar -xzf backups/full_backup_2025-07-01_12-00-00.tar.gz
sudo chown -R www-data:www-data /var/www/html/todo
```

### Csak todo.json visszaállítása

```bash
# Lista a JSON mentésekről
ls -la /var/www/html/todo/backups/todo_backup_*.json

# Visszaállítás
cd /var/www/html/todo
sudo cp backups/todo_backup_2025-07-01_12-00-00.json todo.json
sudo chown www-data:www-data todo.json
```

## Biztonsági másolat letöltése

```bash
# Legfrissebb teljes backup letöltése
scp user@server:/var/www/html/todo/backups/full_backup_$(ls -t /var/www/html/todo/backups/ | head -1) ./

# vagy
wget http://your-server/todo/backups/full_backup_YYYY-MM-DD_HH-MM-SS.tar.gz
```

> **Fontos:** A `.htaccess` alapértelmezetten védi a backup könyvtárat, de érdemes további biztonsági intézkedéseket tenni!
