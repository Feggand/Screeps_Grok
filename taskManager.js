// taskManager.js
var logger = require('logger');

var taskManager = {
    getWorkerTasks: function(room) {
        let tasks = [];
        // (Unverändert, wie zuvor)
        let damagedWalls = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax * 0.0003
        });
        damagedWalls.forEach(wall => {
            tasks.push({
                type: 'repair',
                target: wall.id,
                priority: 10 - (wall.hits / (wall.hitsMax * 0.5)) * 10
            });
        });

        let damagedRoads = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax
        });
        damagedRoads.forEach(road => {
            tasks.push({
                type: 'repair',
                target: road.id,
                priority: 5
            });
        });

        let constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        constructionSites.forEach(site => {
            let priority = 10;
            if (site.structureType === STRUCTURE_CONTAINER && site.pos.getRangeTo(room.controller) <= 3) {
                priority = 14;
            }
            tasks.push({
                type: 'construct',
                target: site.id,
                priority: priority
            });
        });

        let controllerProgress = room.controller.progress / room.controller.progressTotal;
        let upgradePriority = 7 + (1 - controllerProgress) * 3;
        tasks.push({
            type: 'upgrade',
            target: room.controller.id,
            priority: upgradePriority
        });

        tasks.sort((a, b) => b.priority - a.priority);
        logger.info('Worker tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks;
    },

    getHaulerTasks: function(room) {
        let tasks = [];

        // Energie liefern an Controller-Container (höchste Priorität)
        let controllerContainer = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];
        if (controllerContainer) {
            tasks.push({
                type: 'deliver',
                target: controllerContainer.id,
                priority: 12 // Höchste Priorität für Controller-Container
            });
        }

        // Energie liefern an Spawns und Extensions
        let energyTargets = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_TOWER) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        energyTargets.forEach(target => {
            let priority = 0;
            if (target.structureType === STRUCTURE_TOWER && target.store[RESOURCE_ENERGY] < target.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
                priority = 14;
            } else if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) {
                priority = 13;
            } else {
                priority = 5;
            }
            tasks.push({
                type: 'deliver',
                target: target.id,
                priority: priority
            });
        });

        // Energie liefern an Storage (niedrigere Priorität)
        let storageDeliver = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        storageDeliver.forEach(store => {
            tasks.push({
                type: 'deliver',
                target: store.id,
                priority: 4 // Niedriger als Controller-Container und Spawns/Extensions
            });
        });

        // Energie sammeln aus Containern
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        containers.forEach(container => {
            let energyPercentage = container.store[RESOURCE_ENERGY] / container.store.getCapacity(RESOURCE_ENERGY);
            tasks.push({
                type: 'collect',
                target: container.id,
                priority: 7 + energyPercentage * 3
            });
        });

        // Energie sammeln aus dropped resources
        let droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY
        });
        droppedEnergy.forEach(resource => {
            tasks.push({
                type: 'collect',
                target: resource.id,
                priority: 9
            });
        });

        // Energie sammeln aus Tombstones
        let tombstones = room.find(FIND_TOMBSTONES, {
            filter: t => t.store[RESOURCE_ENERGY] > 0
        });
        tombstones.forEach(tombstone => {
            tasks.push({
                type: 'collect',
                target: tombstone.id,
                priority: 9
            });
        });

        // Energie sammeln aus Storage (niedrige Priorität)
        let storageForCollect = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0
        });
        storageForCollect.forEach(store => {
            tasks.push({
                type: 'collect',
                target: store.id,
                priority: 6
            });
        });

        tasks.sort((a, b) => b.priority - a.priority);
        logger.info('Hauler tasks for ' + room.name + ': ' + JSON.stringify(tasks.map(t => ({ type: t.type, target: t.target, priority: t.priority }))));
        return tasks;
    },

    assignTask: function(creep, tasks) {
        if (tasks.length > 0) {
            creep.memory.task = tasks[0].type;
            creep.memory.targetId = tasks[0].target;
            logger.info(creep.name + ': Aufgabe zugewiesen - ' + tasks[0].type + ' auf ' + tasks[0].target);
        } else {
            creep.memory.task = 'idle';
            creep.memory.targetId = null;
            logger.info(creep.name + ': Keine Aufgaben verfügbar, idle');
        }
    }
};

module.exports = taskManager;