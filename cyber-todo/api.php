<?php
/**
 * CYBER-TODO v1.2.1 API
 * REST API a feladatok és Telegram beállítások kezeléséhez
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$DATA_FILE = __DIR__ . '/todo.json';
$LOCK_FILE = __DIR__ . '/todo.json.lock';
$BACKUP_DIR = __DIR__ . '/backups';

function readData() {
    global $DATA_FILE;
    if (!file_exists($DATA_FILE)) {
        return ['tasks' => [], 'telegram' => getTelegramDefaults(), 'version' => '1.2.0'];
    }
    $content = file_get_contents($DATA_FILE);
    if ($content === false) {
        return ['tasks' => [], 'telegram' => getTelegramDefaults(), 'version' => '1.2.0'];
    }
    $decoded = json_decode($content, true);
    if ($decoded === null) {
        return ['tasks' => [], 'telegram' => getTelegramDefaults(), 'version' => '1.2.0'];
    }
    return $decoded;
}

function createBackup() {
    global $DATA_FILE, $BACKUP_DIR;
    if (!file_exists($BACKUP_DIR)) {
        mkdir($BACKUP_DIR, 0755, true);
    }
    if (file_exists($DATA_FILE)) {
        $timestamp = date('Y-m-d_H-i-s');
        $backupFile = $BACKUP_DIR . '/todo_backup_' . $timestamp . '.json';
        copy($DATA_FILE, $backupFile);
        cleanupOldBackups();
    }
}

function cleanupOldBackups($keepCount = 10) {
    global $BACKUP_DIR;
    if (!is_dir($BACKUP_DIR)) return;
    
    $files = glob($BACKUP_DIR . '/todo_backup_*.json');
    if (count($files) <= $keepCount) return;
    
    usort($files, function($a, $b) {
        return filemtime($b) - filemtime($a);
    });
    
    for ($i = $keepCount; $i < count($files); $i++) {
        unlink($files[$i]);
    }
}

function writeData($data) {
    global $DATA_FILE, $LOCK_FILE;
    
    createBackup();
    
    if (file_exists($LOCK_FILE)) {
        http_response_code(503);
        echo json_encode(['error' => 'Adatbázis zárolva']);
        exit;
    }
    
    file_put_contents($LOCK_FILE, 'locked');
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        unlink($LOCK_FILE);
        http_response_code(500);
        echo json_encode(['error' => 'JSON kódolási hiba']);
        exit;
    }
    
    $result = file_put_contents($DATA_FILE, $json);
    unlink($LOCK_FILE);
    
    if ($result === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Írási hiba']);
        exit;
    }
    
    return true;
}

function getTelegramDefaults() {
    return [
        'enabled' => false,
        'botToken' => '',
        'chatId' => '',
        'onAdd' => true,
        'onComplete' => true,
        'onDelete' => false,
        'onOverdue' => true,
    ];
}

function genId() {
    return bin2hex(random_bytes(8));
}

function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function sendError($message, $statusCode = 400) {
    sendJsonResponse(['error' => $message, 'success' => false], $statusCode);
}

function sendSuccess($data) {
    sendJsonResponse(array_merge(['success' => true], $data));
}

$method = $_SERVER['REQUEST_METHOD'];

$action = isset($_GET['action']) ? $_GET['action'] : '';
if (empty($action) && isset($_POST['action'])) {
    $action = $_POST['action'];
}

if (empty($action)) {
    sendError('Hiányzó action paraméter');
}

switch ($action) {
    case 'getTasks':
        if ($method !== 'GET') {
            sendError('Csak GET módszer engedélyezett', 405);
        }
        $data = readData();
        sendSuccess(['tasks' => $data['tasks'] ?? []]);
        break;

    case 'addTask':
        if ($method !== 'POST') {
            sendError('Csak POST módszer engedélyezett', 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['text'])) {
            sendError('A feladat szövege kötelező');
        }
        
        $data = readData();
        $task = [
            'id' => genId(),
            'text' => trim($input['text']),
            'completed' => false,
            'priority' => $input['priority'] ?? 'medium',
            'category' => $input['category'] ?? 'other',
            'dueDate' => isset($input['dueDate']) && $input['dueDate'] !== '' ? $input['dueDate'] : null,
            'notes' => $input['notes'] ?? '',
            'createdAt' => time() * 1000,
        ];
        
        array_unshift($data['tasks'], $task);
        writeData($data);
        
        sendSuccess(['task' => $task]);
        break;

    case 'toggleTask':
        if ($method !== 'POST') {
            sendError('Csak POST módszer engedélyezett', 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $taskId = $input['id'] ?? '';
        
        if (empty($taskId)) {
            sendError('Feladat ID kötelező');
        }
        
        $data = readData();
        $found = false;
        foreach ($data['tasks'] as &$task) {
            if ($task['id'] === $taskId) {
                $task['completed'] = !$task['completed'];
                $task['completedAt'] = $task['completed'] ? time() * 1000 : null;
                writeData($data);
                sendSuccess(['task' => $task]);
                $found = true;
                break;
            }
        }
        
        if (!$found) {
            sendError('Feladat nem található', 404);
        }
        break;

    case 'updateTask':
        if ($method !== 'PUT' && $method !== 'POST') {
            sendError('Csak PUT/POST módszer engedélyezett', 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $taskId = $input['id'] ?? '';
        
        if (empty($taskId)) {
            sendError('Feladat ID kötelező');
        }
        
        $data = readData();
        $found = false;
        foreach ($data['tasks'] as &$task) {
            if ($task['id'] === $taskId) {
                if (isset($input['text'])) $task['text'] = trim($input['text']);
                if (isset($input['notes'])) $task['notes'] = $input['notes'];
                if (isset($input['priority'])) $task['priority'] = $input['priority'];
                if (isset($input['category'])) $task['category'] = $input['category'];
                if (isset($input['dueDate'])) $task['dueDate'] = $input['dueDate'] !== '' ? $input['dueDate'] : null;
                writeData($data);
                sendSuccess(['task' => $task]);
                $found = true;
                break;
            }
        }
        
        if (!$found) {
            sendError('Feladat nem található', 404);
        }
        break;

    case 'deleteTask':
        if ($method !== 'DELETE' && $method !== 'POST') {
            sendError('Csak DELETE/POST módszer engedélyezett', 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $taskId = $input['id'] ?? '';
        
        if (empty($taskId)) {
            sendError('Feladat ID kötelező');
        }
        
        $data = readData();
        $deletedTask = null;
        $newTasks = [];
        foreach ($data['tasks'] as $t) {
            if ($t['id'] === $taskId) {
                $deletedTask = $t;
            } else {
                $newTasks[] = $t;
            }
        }
        
        if ($deletedTask) {
            $data['tasks'] = $newTasks;
            writeData($data);
            sendSuccess(['task' => $deletedTask]);
        } else {
            sendError('Feladat nem található', 404);
        }
        break;

    case 'reorderTasks':
        if ($method !== 'POST') {
            sendError('Csak POST módszer engedélyezett', 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $taskIds = $input['taskIds'] ?? [];
        
        if (empty($taskIds)) {
            sendError('Feladat ID lista kötelező');
        }
        
        $data = readData();
        $idToTask = [];
        foreach ($data['tasks'] as $task) {
            $idToTask[$task['id']] = $task;
        }
        
        $newTasks = [];
        foreach ($taskIds as $id) {
            if (isset($idToTask[$id])) {
                $newTasks[] = $idToTask[$id];
            }
        }
        
        $data['tasks'] = $newTasks;
        writeData($data);
        sendSuccess(['tasks' => $data['tasks']]);
        break;

    case 'getTelegram':
        if ($method !== 'GET') {
            sendError('Csak GET módszer engedélyezett', 405);
        }
        $data = readData();
        $telegram = $data['telegram'] ?? getTelegramDefaults();
        sendSuccess(['telegram' => $telegram]);
        break;

    case 'saveTelegram':
        if ($method !== 'POST') {
            sendError('Csak POST módszer engedélyezett', 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        
        $data = readData();
        $data['telegram'] = [
            'enabled' => isset($input['enabled']) ? (bool)$input['enabled'] : false,
            'botToken' => $input['botToken'] ?? '',
            'chatId' => $input['chatId'] ?? '',
            'onAdd' => isset($input['onAdd']) ? (bool)$input['onAdd'] : true,
            'onComplete' => isset($input['onComplete']) ? (bool)$input['onComplete'] : true,
            'onDelete' => isset($input['onDelete']) ? (bool)$input['onDelete'] : false,
            'onOverdue' => isset($input['onOverdue']) ? (bool)$input['onOverdue'] : true,
        ];
        writeData($data);
        
        sendSuccess(['telegram' => $data['telegram']]);
        break;

    case 'testTelegram':
        if ($method !== 'POST') {
            sendError('Csak POST módszer engedélyezett', 405);
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $token = $input['botToken'] ?? '';
        $chatId = $input['chatId'] ?? '';
        
        if (!$token || !$chatId) {
            sendError('Bot Token és Chat ID megadása kötelező');
        }
        
        $text = '⚡ <b>CYBER-TODO v1.2.0</b>%0A%0ATelegram értesítés sikeresen bekötve!%0A%0A🕒 ' . date('Y.m.d. H:i:s');
        
        $postData = json_encode([
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => 'HTML'
        ]);
        
        if (function_exists('curl_init') && extension_loaded('curl')) {
            // cURL módszer
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, "https://api.telegram.org/bot{$token}/sendMessage");
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            
            $result = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);
            
            if ($result !== false && $httpCode === 200) {
                $response = json_decode($result, true);
                if ($response && $response['ok']) {
                    sendSuccess(['message' => 'Teszt üzenet elküldve!']);
                } else {
                    sendError('Telegram hiba: ' . ($response['description'] ?? 'Ismeretlen hiba'), 400);
                }
            } else {
                $errorMsg = $curlError ? " ({$curlError})" : " (HTTP {$httpCode})";
                sendError('Nem sikerült kapcsolódni a Telegram API-hoz' . $errorMsg, 400);
            }
        } else {
            // file_get_contents fallback módszer
            $url = "https://api.telegram.org/bot{$token}/sendMessage";
            
            $options = [
                'ssl' => [
                    'verify_peer' => false,
                    'verify_peer_name' => false,
                ],
                'http' => [
                    'method' => 'POST',
                    'header' => "Content-Type: application/json\r\n",
                    'content' => $postData,
                    'ignore_errors' => true,
                    'timeout' => 10,
                ]
            ];
            
            $context = stream_context_create($options);
            $result = @file_get_contents($url, false, $context);
            
            if ($result !== false) {
                $response = json_decode($result, true);
                if ($response && $response['ok']) {
                    sendSuccess(['message' => 'Teszt üzenet elküldve!']);
                } else {
                    sendError('Telegram hiba: ' . ($response['description'] ?? 'Ismeretlen hiba'), 400);
                }
            } else {
                sendError('Nem sikerült kapcsolódni a Telegram API-hoz', 400);
            }
        }
        break;

    default:
        sendError('Érvénytelen action paraméter: ' . htmlspecialchars($action));
        break;
}
