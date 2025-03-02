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

    logger.info('Main loop running'); // Protokolliert Start der Schleife
    memoryManager.initializeMemory(); // Initialisiert oder aktualisiert den Speicher
    logger.info('Memory initialized'); // Bestätigt Speicherinitialisierung

    // Alle 100 Ticks: Bereinigt Speicher von toten oder ungültigen Creeps
    if (Game.time % 100 === 0) {
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
        let roomMemory = Memory.rooms[roomName] || {}; // Holt Raum-Speicher oder leeres Objekt
        let isMyRoom = roomMemory.isMyRoom || false; // Prüft, ob der Raum mir gehört
        logger.info(`Processing room ${roomName}, isMyRoom: ${isMyRoom}`); // Protokolliert Raumverarbeitung

        spawnManager.manageSpawns(room); // Verwaltet Spawns im Raum
        structureBuilder.buildStructures(room); // Baut Strukturen im Raum
        structureBuilder.buildControllerContainer(room); // Baut Container nahe dem Controller
        logger.info(`Room ${roomName} processed`); // Bestätigt Raumverarbeitung
    }

    // Zweite Schleife für zusätzliche Struktur- und Link-Logik
    for (var roomName in Game.rooms) {
        var room = Game.rooms[roomName];
        structureBuilder.buildStructures(room); // Baut Strukturen erneut (redundant?)
        roleLink.run(); // Führt Link-Logik aus (für alle Räume in jeder Iteration)
    }

    creepManager.runCreeps(); // Führt die Logik für alle Creeps aus
    roleTower.run(); // Führt die Turm-Logik aus
    logger.info('Creeps run'); // Bestätigt Creep-Ausführung
};