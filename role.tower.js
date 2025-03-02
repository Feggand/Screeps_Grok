// role.tower.js
// Logik für Tower-Strukturen, die angreifen, heilen und reparieren

var logger = require('logger'); // Importiert Logging-Modul
var taskManager = require('taskManager'); // Importiert Task-Manager-Modul

module.exports.run = function() {
    // Durchläuft alle sichtbaren Räume
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue; // Überspringt Räume, die nicht mir gehören

        let towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        }); // Findet alle Türme im Raum

        if (towers.length === 0) continue; // Keine Türme -> überspringen

        let tasks = taskManager.getTowerTasks(room); // Holt verfügbare Turm-Aufgaben
        let assignedTasks = new Set(); // Verfolgt zugewiesene Aufgaben, um Doppelzuweisungen zu vermeiden

        for (let tower of towers) {
            if (tasks.length === 0) {
                logger.info('Tower in ' + room.name + ': Keine Aufgaben verfügbar');
                continue;
            }

            // Findet die erste nicht zugewiesene Aufgabe
            let task = null;
            for (let potentialTask of tasks) {
                if (!assignedTasks.has(potentialTask.target)) {
                    task = potentialTask;
                    break;
                }
            }

            if (!task) {
                logger.info('Tower in ' + room.name + ': Alle Aufgaben bereits zugewiesen');
                continue;
            }

            let target = Game.getObjectById(task.target); // Holt Ziel der Aufgabe
            if (!target) {
                logger.warn('Tower in ' + room.name + ': Ungültiges Ziel ' + task.target + ' für Aufgabe ' + task.type);
                continue;
            }

            if (task.type === 'attack') { // Angriffsaufgabe
                let result = tower.attack(target); // Greift feindliches Ziel an
                if (result === OK) {
                    logger.info('Tower in ' + room.name + ' attacking hostile ' + target.id + ' at ' + target.pos);
                    assignedTasks.add(task.target); // Markiert Aufgabe als zugewiesen
                } else {
                    logger.warn('Tower in ' + room.name + ': Attack failed: ' + result); // Fehler protokollieren
                }
            } else if (task.type === 'heal') { // Heilungsaufgabe
                let result = tower.heal(target); // Heilt freundlichen Creep
                if (result === OK) {
                    logger.info('Tower in ' + room.name + ' healing creep ' + target.name + ' at ' + target.pos);
                    assignedTasks.add(task.target); // Markiert Aufgabe als zugewiesen
                } else {
                    logger.warn('Tower in ' + room.name + ': Heal failed: ' + result); // Fehler protokollieren
                }
            } else if (task.type === 'repair') { // Reparaturaufgabe
                let result = tower.repair(target); // Repariert Struktur
                if (result === OK) {
                    logger.info('Tower in ' + room.name + ' repairing ' + target.structureType + ' ' + target.id + ' at ' + target.pos);
                    assignedTasks.add(task.target); // Markiert Aufgabe als zugewiesen
                } else {
                    logger.warn('Tower in ' + room.name + ': Repair failed: ' + result); // Fehler protokollieren
                }
            }
        }
    }
};