// main.js
// Hauptschleife des Screeps-Spiels, die alle Manager-Module koordiniert

var creepManager = require('creepManager'); // Importiert Modul zur Creep-Verwaltung
var spawnManager = require('spawnManager'); // Importiert Modul zur Spawn-Verwaltung
var structureBuilder = require('structureBuilder'); // Importiert Modul zum Bau von Strukturen
var memoryManager = require('memoryManager'); // Importiert Modul zur Speicherverwaltung
var logger = require('logger'); // Importiert Logging-Modul
var roleTower = require('role.tower'); // Importiert Turm-Logik
var roleLink = require('role.link'); // Importiert Link-Logik

module.exports.loop = function () {
    // Hauptspielschleife, die bei jedem Tick ausgeführt wird
    let cpuStart = Game.cpu.getUsed(); // Misst CPU-Nutzung am Anfang des Ticks

    logger.info('Main loop running'); // Protokolliert Start der Schleife

    // Initialisiert oder aktualisiert den Speicher und cached die Ergebnisse
    memoryManager.initializeMemory();
    logger.info('Memory initialized'); // Bestätigt Speicherinitialisierung

    // Cached Ergebnisse für alle Räume einmalig am Tickanfang abrufen
    let cachedRooms = {};
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        cachedRooms[roomName] = {
            myRoom: room.controller && room.controller.my, // Cached ob der Raum mir gehört
            structures: room.find(FIND_STRUCTURES), // Cached Strukturen im Raum
            constructionSites: room.find(FIND_CONSTRUCTION_SITES), // Cached Baustellen
            sources: room.find(FIND_SOURCES) // Cached Quellen
        };
    }

    // Bereinigt Speicher von toten oder ungültigen Creeps alle 50 Ticks für bessere Reaktionszeit
    if (Game.time % 50 === 0) {
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                logger.info(`Removing dead creep ${name} from Memory`); // Entfernt tote Creeps
                delete Memory.creeps[name];
            } else if (Memory.creeps[name] === undefined || Object.keys(Memory.creeps[name]).length === 0) {
                logger.warn(`Removing invalid creep ${name} (undefined or empty) from Memory`); // Entfernt ungültige Einträge
                delete Memory.creeps[name];
            }
        }
    }

    // Durchläuft alle sichtbaren Räume und führt raumspezifische Logik aus
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName]; // Zugriff auf das Raum-Objekt
        let cachedData = cachedRooms[roomName]; // Nutzt gecachte Daten für diesen Raum
        if (cachedData) { // Prüft, ob cachedData gültig ist, um Fehler bei unsichtbaren Räumen zu vermeiden
            let isMyRoom = cachedData.myRoom; // Nutzt cached Wert für isMyRoom
            logger.info(`Processing room ${roomName}, isMyRoom: ${isMyRoom}`); // Protokolliert Raumverarbeitung

            // Verarbeite nur eigene Räume, um CPU zu sparen
            if (isMyRoom) {
                spawnManager.manageSpawns(room); // Verwaltet Spawns im Raum mit cached Daten
                structureBuilder.buildStructures(room, cachedData); // Übergebe cachedData an buildStructures
                structureBuilder.buildControllerContainer(room, cachedData); // Übergebe cachedData an buildControllerContainer
                roleLink.run(); // Führt Link-Logik für diesen Raum aus, um Redundanzen zu vermeiden
            }
            logger.info(`Room ${roomName} processed`); // Bestätigt Raumverarbeitung
        } else {
            logger.warn(`No cached data available for room ${roomName}, skipping processing`); // Warnung, wenn keine Daten gecacht sind
        }
    }

    creepManager.runCreeps(); // Führt die Logik für alle Creeps aus mit cached Daten
    roleTower.run(); // Führt die Turm-Logik aus
    logger.info('Creeps run'); // Bestätigt Creep-Ausführung

    // CPU-Überwachung am Ende des Ticks
    let cpuUsed = Game.cpu.getUsed() - cpuStart; // Berechnet genutzte CPU
    let cpuLimit = Game.cpu.limit; // Holt CPU-Limit
    if (cpuUsed > cpuLimit * 0.8) { // Warnung bei 80% Auslastung
        logger.warn(`High CPU usage detected: ${cpuUsed.toFixed(2)}ms out of ${cpuLimit}ms limit`);
    } else {
        logger.info(`CPU usage: ${cpuUsed.toFixed(2)}ms out of ${cpuLimit}ms limit`);
    }
};