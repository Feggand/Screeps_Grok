// taskManager.js
var logger = require('logger');

var taskManager = {
    getWorkerTasks: function(room) {
        let tasks = [];

        // Reparatur von Wänden, nur wenn unter 50% Trefferpunkte
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

        // Reparatur von Straßen
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

        // Baustellen hinzufügen
        let constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        constructionSites.forEach(site => {
            tasks.push({
                type: 'construct',
                target: site.id,
                priority: 8
            });
        });

        // Upgraden des Controllers
        let controllerProgress = room.controller.progress / room.controller.progressTotal;
        let upgradePriority = 7 + (1 - controllerProgress) * 3;
        tasks.push({
            type: 'upgrade',
            target: room.controller.id,
            priority: upgradePriority
        });

        tasks.sort((a, b) => b.priority - a.priority);
        return tasks;
    },

    getHaulerTasks: function(room) {
        let tasks = [];

        // Energie liefern an Strukturen (Spawns, Extensions, Türme)
        let energyTargets = room.find(FIND_STRUCTURES, {
            filter: s => (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_TOWER) && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        energyTargets.forEach(target => {
            let priority = 0;
            if (target.structureType === STRUCTURE_TOWER && target.store[RESOURCE_ENERGY] < target.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
                priority = 10; // Hohe Priorität für Türme mit wenig Energie
            } else if (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION) {
                priority = 8; // Mittlere Priorität für Spawns und Extensions
            } else {
                priority = 5; // Niedrigere Priorität für Türme mit mehr Energie
            }
            tasks.push({
                type: 'deliver',
                target: target.id,
                priority: priority
            });
        });

        // Energie liefern an Storage (nur wenn Spawns/Extensions voll)
        let storageDeliver = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_STORAGE && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
        storageDeliver.forEach(store => {
            tasks.push({
                type: 'deliver',
                target: store.id,
                priority: 4 // Niedrigste Priorität für Storage
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

        // Energie sammeln aus Storage
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