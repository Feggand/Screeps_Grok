// role.tower.js
var logger = require('logger');
var taskManager = require('taskManager');

module.exports.run = function() {
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;

        let towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });

        if (towers.length === 0) continue;

        let tasks = taskManager.getTowerTasks(room);
        let assignedTasks = new Set(); // Verfolgt bereits zugewiesene Aufgaben

        for (let tower of towers) {
            if (tasks.length === 0) {
                logger.info('Tower in ' + room.name + ': Keine Aufgaben verfügbar');
                continue;
            }

            // Finde die erste nicht zugewiesene Aufgabe
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

            let target = Game.getObjectById(task.target);
            if (!target) {
                logger.warn('Tower in ' + room.name + ': Ungültiges Ziel ' + task.target + ' für Aufgabe ' + task.type);
                continue;
            }

            if (task.type === 'attack') {
                let result = tower.attack(target);
                if (result === OK) {
                    logger.info('Tower in ' + room.name + ' attacking hostile ' + target.id + ' at ' + target.pos);
                    assignedTasks.add(task.target);
                } else {
                    logger.warn('Tower in ' + room.name + ': Attack failed: ' + result);
                }
            } else if (task.type === 'heal') {
                let result = tower.heal(target);
                if (result === OK) {
                    logger.info('Tower in ' + room.name + ' healing creep ' + target.name + ' at ' + target.pos);
                    assignedTasks.add(task.target);
                } else {
                    logger.warn('Tower in ' + room.name + ': Heal failed: ' + result);
                }
            } else if (task.type === 'repair') {
                let result = tower.repair(target);
                if (result === OK) {
                    logger.info('Tower in ' + room.name + ' repairing ' + target.structureType + ' ' + target.id + ' at ' + target.pos);
                    assignedTasks.add(task.target);
                } else {
                    logger.warn('Tower in ' + room.name + ': Repair failed: ' + result);
                }
            }
        }
    }
};