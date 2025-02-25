var logger = require('logger');

var taskManager = {
    getTasks: function(room) {
        let tasks = [];

        // Reparatur von Wänden, nur wenn unter 50% Trefferpunkte
        let damagedWalls = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax * 0.0003
        });
        damagedWalls.forEach(wall => {
            tasks.push({
                type: 'repair',
                target: wall.id,
                priority: 10 - (wall.hits / (wall.hitsMax * 0.5)) * 10 // Höhere Priorität bei mehr Schaden
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

        // Baustellen hinzufügen
        let constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        constructionSites.forEach(site => {
            tasks.push({
                type: 'construct',
                target: site.id,
                priority: 10 // Höher als Upgrade, niedriger als dringende Reparaturen
            });
        });

        // Upgraden des Controllers
        let controllerProgress = room.controller.progress / room.controller.progressTotal;
        let upgradePriority = 7 + (1 - controllerProgress) * 3; // Höhere Priorität, wenn Fortschritt niedrig
        tasks.push({
            type: 'upgrade',
            target: room.controller.id,
            priority: upgradePriority
        });

        // Aufgaben nach Priorität sortieren
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