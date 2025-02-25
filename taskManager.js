var logger = require('logger');

var taskManager = {
    getTasks: function(room) {
        let tasks = [];

        // Reparatur von Wänden
        let damagedWalls = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax * 0.5
        });
        damagedWalls.forEach(wall => {
            tasks.push({
                type: 'repair',
                target: wall.id,
                priority: 10 - (wall.hits / wall.hitsMax) * 10 // Höhere Priorität bei mehr Schaden
            });
        });

        // Reparatur von Straßen
        let damagedRoads = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax
        });
        damagedRoads.forEach(road => {
            tasks.push({
                type: 'repair',
                target: road.id,
                priority: 5 // Feste Priorität für Straßen
            });
        });

        // Upgraden des Controllers
        tasks.push({
            type: 'upgrade',
            target: room.controller.id,
            priority: 7 // Mittlere Priorität
        });

        // Sortiere Aufgaben nach Priorität
        tasks.sort((a, b) => b.priority - a.priority);
        return tasks;
    },

    assignTask: function(creep, tasks) {
        if (tasks.length > 0) {
            creep.memory.task = tasks[0].type;
            creep.memory.targetId = tasks[0].target;
            logger.info(creep.name + ': Aufgabe zugewiesen - ' + tasks[0].type + ' auf ' + tasks[0].target);
        } else {
            creep.memory.task = 'idle';
            logger.info(creep.name + ': Keine Aufgaben verfügbar, idle');
        }
    }
};

module.exports = taskManager;