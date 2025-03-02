// creepManager.js
// Dieses Modul verwaltet die Creeps und führt ihre Rollenlogik aus.

var logger = require('logger'); // Importiert das Logger-Modul für Debugging und Protokollierung

module.exports = {
    // Hauptfunktion, die alle Creeps durchläuft und ihre Rollen ausführt
    runCreeps: function() {
        // Iteriert über alle Creeps im Spiel
        for (let name in Game.creeps) {
            let creep = Game.creeps[name]; // Zugriff auf das Creep-Objekt
            let role = creep.memory.role; // Holt die Rolle aus dem Creep-Speicher

            // Überprüft, ob die Rolle gültig ist (existiert, String, nicht 'undefined')
            if (!role || typeof role !== 'string' || role === 'undefined') {
                logger.warn(`Invalid or undefined role for creep ${name}, determining role from body`);
                // Versucht, die Rolle basierend auf dem Körper zu bestimmen
                if (this.determineRole(creep)) {
                    role = creep.memory.role; // Aktualisiert die Rolle, wenn erfolgreich bestimmt
                } else {
                    // Fallback-Rolle zuweisen, wenn Bestimmung fehlschlägt
                    creep.memory.role = this.getFallbackRole(creep);
                    role = creep.memory.role;
                    logger.info(`Assigned fallback role ${role} to creep ${name}`);
                }
            }

            try {
                // Lädt das Modul der spezifischen Rolle dynamisch und führt es aus
                let roleModule = require('role.' + role);
                roleModule.run(creep); // Führt die run-Funktion des Rollenmoduls für den Creep aus
            } catch (error) {
                // Protokolliert Fehler, falls das Rollenmodul nicht geladen oder ausgeführt werden kann
                logger.error(`Error running role ${role} for creep ${name}: ${error.message}`);
            }
        }
    },

    // Funktion zur Bestimmung der Rolle eines Creeps basierend auf seinen Körperteilen
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
    getFallbackRole: function(creep) {
        return 'worker'; // Standard-Fallback-Rolle ist 'worker'
        // Hinweis: Kann später dynamischer gestaltet werden, z. B. basierend auf Raumbedarf
    }
};