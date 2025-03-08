// creepManager.js
// Modul zur Verwaltung und Ausführung der Creep-Logik
// Verantwortlich für die Koordination aller Creeps basierend auf ihren Rollen
// Implementiert ein Caching-System, um CPU-Nutzung zu optimieren, und behält die bestehende Rollenbestimmung bei

var logger = require('logger'); // Importiert das Logging-Modul für detaillierte Protokollierung
var _ = require('lodash'); // Importiert Lodash für Array-Funktionen wie _.some und _.filter

module.exports = {
    // Hauptfunktion, die alle Creeps durchläuft und ihre Rollen ausführt
    // Nutzt ein Caching-System, um wiederholte room.find()-Aufrufe zu minimieren
    runCreeps: function() {
        let cpuStart = Game.cpu.getUsed(); // Misst die CPU-Nutzung am Anfang der Creep-Verarbeitung

        // Cached Daten für alle Räume einmalig abrufen, um CPU zu sparen
        let cachedRooms = {};
        for (let roomName in Game.rooms) {
            let room = Game.rooms[roomName];
            cachedRooms[roomName] = {
                structures: room.find(FIND_STRUCTURES), // Cached Strukturen im Raum
                sources: room.find(FIND_SOURCES), // Cached Quellen im Raum
                containers: room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }), // Cached Container
                storage: room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE })[0], // Cached Storage (erstes Element)
                lastUpdate: Game.time // Zeitstempel der letzten Aktualisierung
            };
            logger.info(`Cached data initialized for room ${roomName} at tick ${Game.time}`); // Ersetze debug durch info
        }

        // Durchlaufe alle Creeps und führe ihre Rollen aus
        for (let name in Game.creeps) {
            let creep = Game.creeps[name]; // Zugriff auf das Creep-Objekt
            let role = creep.memory.role; // Holt die Rolle aus dem Creep-Speicher

            // Überprüft, ob die Rolle gültig ist (existiert, String, nicht 'undefined')
            if (!role || typeof role !== 'string' || role === 'undefined') {
                logger.warn(`Invalid or undefined role for creep ${name}, determining role from body`);
                // Versucht, die Rolle basierend auf dem Körper zu bestimmen
                if (this.determineRole(creep)) {
                    role = creep.memory.role; // Aktualisiert die Rolle, wenn erfolgreich bestimmt
                    logger.info(`Determined role ${role} for creep ${name} based on body`);
                } else {
                    // Fallback-Rolle zuweisen, wenn Bestimmung fehlschlägt
                    creep.memory.role = this.getFallbackRole(creep);
                    role = creep.memory.role;
                    logger.info(`Assigned fallback role ${role} to creep ${name}`);
                }
            }

            try {
                // Lädt das Modul der spezifischen Rolle dynamisch und führt es aus
                // Nutzt gecachte Daten basierend auf dem Heimraum des Creeps oder dem aktuellen Raum
                let cachedData = cachedRooms[creep.memory.home || creep.room.name] || {};
                let roleModule = require('role.' + role);
                roleModule.run(creep, cachedData); // Führt die run-Funktion des Rollenmoduls mit gecachten Daten aus
            } catch (error) {
                // Protokolliert Fehler, falls das Rollenmodul nicht geladen oder ausgeführt werden kann
                logger.error(`Error running role ${role} for creep ${name}: ${error.message}`);
            }
        }

        let cpuUsed = Game.cpu.getUsed() - cpuStart; // Berechnet die genutzte CPU für Creeps
        logger.info(`Creeps run, CPU usage: ${cpuUsed.toFixed(2)}ms`); // Protokolliert die Creep-CPU-Nutzung
    },

    // Funktion zur Bestimmung der Rolle eines Creeps basierend auf seinen Körperteilen
    // Analysiert die Körperteile und weist eine Rolle basierend auf deren Zusammensetzung zu
    determineRole: function(creep) {
        let body = creep.body; // Zugriff auf die Körperteile des Creeps
        let hasWork = _.some(body, part => part.type === WORK); // Prüft auf WORK-Teile (Arbeiten)
        let hasCarry = _.some(body, part => part.type === CARRY); // Prüft auf CARRY-Teile (Transport)
        let hasMove = _.some(body, part => part.type === MOVE); // Prüft auf MOVE-Teile (Bewegung)

        // Logik zur Rollenbestimmung basierend auf Körperteilen
        if (hasCarry && hasMove && !hasWork) {
            creep.memory.role = 'hauler'; // Nur CARRY und MOVE -> Hauler
            return true;
        } else if (hasWork && hasCarry && hasMove) {
            // WORK, CARRY und MOVE vorhanden -> Hauler oder Worker
            if (_.filter(body, part => part.type === CARRY).length > _.filter(body, part => part.type === WORK).length) {
                creep.memory.role = 'hauler'; // Mehr CARRY als WORK -> Hauler
            } else {
                creep.memory.role = 'worker'; // Mehr oder gleich WORK -> Worker
            }
            return true;
        } else if (hasWork && !hasCarry && hasMove) {
            creep.memory.role = 'harvester'; // WORK und MOVE -> Harvester
            return true;
        } else if (hasMove && !hasWork && !hasCarry) {
            creep.memory.role = 'scout'; // Nur MOVE -> Scout
            return true;
        } else if (hasWork && hasCarry && !hasMove) {
            creep.memory.role = 'remoteHarvester'; // WORK und CARRY ohne MOVE -> RemoteHarvester
            return true;
        }
        return false; // Keine Rolle bestimmbar
    },

    // Fallback-Funktion, um eine Standardrolle zuzuweisen, wenn die Bestimmung fehlschlägt
    // Aktuell wird 'worker' als Standardrolle festgelegt
    getFallbackRole: function(creep) {
        return 'worker'; // Standard-Fallback-Rolle ist 'worker'
        // Hinweis: Kann später dynamischer gestaltet werden, z. B. basierend auf Raumbedarf
    }
};