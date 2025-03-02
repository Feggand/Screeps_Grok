// role.harvester.js
// Logik für Harvester-Creeps, die Energie abbauen und in Container lagern

var logger = require('logger'); // Importiert Logging-Modul
var taskManager = require('taskManager'); // Importiert Task-Manager-Modul zur Aufgabenverwaltung

module.exports.run = function(creep) {
    // Prüft, ob die aktuelle Aufgabe noch gültig ist
    let taskValid = false;
    let target = Game.getObjectById(creep.memory.targetId); // Holt das Ziel der Aufgabe
    if (creep.memory.task && target) {
        if (creep.memory.task === 'harvest') {
            let container = Game.getObjectById(creep.memory.containerId); // Holt den Container
            // Aufgabe gültig, wenn Quelle Energie hat und Container Platz
            taskValid = target.energy > 0 && container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        } else if (creep.memory.task === 'constructContainer') {
            // Aufgabe gültig, wenn kein Container in Reichweite der Quelle ist
            taskValid = !target.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER })[0];
        } else if (creep.memory.task === 'repair') {
            // Aufgabe gültig, wenn das Ziel beschädigt ist
            taskValid = target.hits < target.hitsMax;
        }
    } else if (!target && creep.memory.task) {
        // Ungültiges Ziel: Aufgabe zurücksetzen
        logger.info(creep.name + ': Ziel ungültig (task: ' + creep.memory.task + ', targetId: ' + creep.memory.targetId + '), Aufgabe zurückgesetzt');
        delete creep.memory.task;
        delete creep.memory.targetId;
        delete creep.memory.containerId;
    }

    // Wenn die Aufgabe ungültig ist oder keine existiert, neue zuweisen
    if (!taskValid || !creep.memory.task) {
        let tasks = taskManager.getHarvesterTasks(creep.room); // Holt verfügbare Harvester-Aufgaben
        taskManager.assignTask(creep, tasks); // Weist die höchstpriorisierte Aufgabe zu
    }

    // Führt die zugewiesene Aufgabe aus
    if (creep.memory.task === 'harvest') {
        let source = Game.getObjectById(creep.memory.targetId); // Energiequelle
        let container = Game.getObjectById(creep.memory.containerId); // Ziel-Container
        if (!source || !container) {
            logger.warn(creep.name + ': Ungültige Quelle oder Container, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
            delete creep.memory.containerId;
            return;
        }

        if (creep.store.getFreeCapacity() > 0) { // Wenn Creep Platz für Energie hat
            if (creep.pos.isEqualTo(container.pos)) { // Bereits auf Container-Position
                let result = creep.harvest(source); // Erntet Energie von der Quelle
                if (result === OK) {
                    logger.info(creep.name + ': Harvesting source ' + source.id);
                } else {
                    logger.warn(creep.name + ': Harvesting failed: ' + result);
                }
            } else {
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zum Container
                logger.info(creep.name + ': Moving to container at ' + container.pos);
            }
        } else { // Creep ist voll
            let result = creep.transfer(container, RESOURCE_ENERGY); // Überträgt Energie in Container
            if (result === OK) {
                logger.info(creep.name + ': Transferring to container ' + container.id);
            } else if (result === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zum Container
            } else {
                logger.warn(creep.name + ': Transfer failed: ' + result);
            }
        }
    } else if (creep.memory.task === 'constructContainer') {
        let source = Game.getObjectById(creep.memory.targetId); // Energiequelle
        if (!source) {
            logger.warn(creep.name + ': Ungültige Quelle, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
            return;
        }

        let site = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { 
            filter: s => s.structureType === STRUCTURE_CONTAINER 
        })[0]; // Prüft auf Baustelle für Container
        if (!site && creep.store[RESOURCE_ENERGY] > 0) { // Keine Baustelle, aber Energie vorhanden
            let result = creep.room.createConstructionSite(source.pos.x, source.pos.y + 1, STRUCTURE_CONTAINER); // Erstellt Baustelle
            if (result === OK) {
                logger.info(creep.name + ': Creating container construction site near source ' + source.id);
            } else {
                logger.warn(creep.name + ': Failed to create container site: ' + result);
            }
        } else if (site) { // Baustelle existiert
            if (creep.build(site) === ERR_NOT_IN_RANGE) {
                creep.moveTo(site, { visualizePathStyle: { stroke: '#0000ff' } }); // Bewegt sich zur Baustelle
                logger.info(creep.name + ': Moving to build container at ' + site.pos);
            } else {
                logger.info(creep.name + ': Building container at ' + site.pos); // Baut Container
            }
        } else { // Keine Baustelle und keine Energie
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zur Quelle
                logger.info(creep.name + ': Moving to source ' + source.id + ' to gather energy');
            } else {
                logger.info(creep.name + ': Harvesting source ' + source.id + ' for construction'); // Erntet Energie
            }
        }
    } else if (creep.memory.task === 'repair') {
        let target = Game.getObjectById(creep.memory.targetId); // Reparaturziel
        if (!target) {
            logger.warn(creep.name + ': Ungültiges Reparaturziel, Aufgabe zurückgesetzt');
            delete creep.memory.task;
            delete creep.memory.targetId;
            return;
        }

        if (creep.store[RESOURCE_ENERGY] > 0) { // Wenn Energie vorhanden
            if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zum Ziel
                logger.info(creep.name + ': Moving to repair ' + target.structureType + ' at ' + target.pos);
            } else {
                logger.info(creep.name + ': Repairing ' + target.structureType + ' at ' + target.pos); // Repariert Struktur
            }
        } else { // Keine Energie
            let source = creep.pos.findClosestByPath(FIND_SOURCES); // Nächstgelegene Quelle
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zur Quelle
                logger.info(creep.name + ': Moving to source ' + source.id + ' for energy');
            }
        }
    } else if (creep.memory.task === 'idle') {
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS); // Nächstgelegener Spawn
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zum Spawn
            logger.info(creep.name + ': Idle, moving to spawn ' + spawn.id);
        }
    }
};