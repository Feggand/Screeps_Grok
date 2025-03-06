// role.mineralHarvester.js
var logger = require('logger');

module.exports.run = function(creep, cachedData) {
    let targetRoom = creep.memory.targetRoom;
    let mineral = null;
    let extractor = null;
    let storage = creep.room.storage;

    // Prüfe den Zielraum
    if (creep.room.name !== targetRoom) {
        creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        logger.info(creep.name + ': Moving to target room ' + targetRoom);
        return;
    }

    // Nutze gecachte Daten, falls verfügbar
    if (cachedData) {
        mineral = cachedData.minerals ? cachedData.minerals[0] : null;
        extractor = cachedData.structures ? cachedData.structures.find(s => s.structureType === STRUCTURE_EXTRACTOR) : null;
        storage = cachedData.structures ? cachedData.structures.find(s => s.structureType === STRUCTURE_STORAGE) : creep.room.storage;
    }

    // Finde Mineral, Extractor und Storage, wenn nicht gecacht oder nicht gefunden
    if (!mineral) {
        mineral = creep.room.find(FIND_MINERALS)[0];
        if (cachedData && !cachedData.minerals) cachedData.minerals = [mineral]; // Cache Mineral
    }
    if (!extractor) {
        extractor = creep.room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR })[0];
        if (cachedData && !cachedData.structures) cachedData.structures = creep.room.find(FIND_STRUCTURES); // Cache Strukturen, falls noch nicht vorhanden
        else if (cachedData && cachedData.structures) cachedData.structures = cachedData.structures.concat(extractor); // Füge Extractor hinzu
    }
    if (!storage) {
        storage = creep.room.storage;
        if (cachedData && !cachedData.structures) cachedData.structures = creep.room.find(FIND_STRUCTURES); // Cache Strukturen, falls noch nicht vorhanden
        else if (cachedData && cachedData.structures) cachedData.structures = cachedData.structures.concat(storage); // Füge Storage hinzu
    }

    if (!mineral || !extractor || !storage) {
        logger.warn(creep.name + ': Missing mineral, extractor, or storage in ' + creep.room.name);
        creep.memory.task = 'idle'; // Wechsle in idle-Modus
        creep.memory.targetId = null;
        let spawn = creep.pos.findClosestByPath((cachedData && cachedData.structures) ? 
            cachedData.structures.filter(s => s.structureType === STRUCTURE_SPAWN) : 
            FIND_MY_SPAWNS);
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            logger.info(creep.name + ': Moving to spawn due to missing resources');
        }
        return;
    }

    // Wenn der Creep Platz hat und Mineralien verfügbar sind, abbauen
    if (creep.store.getFreeCapacity() > 0 && mineral.mineralAmount > 0) {
        if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
            creep.moveTo(mineral, { visualizePathStyle: { stroke: '#ffaa00' } });
            logger.info(creep.name + ': Moving to mineral ' + mineral.id + ' in ' + creep.room.name);
        } else if (creep.harvest(mineral) === OK) {
            logger.info(creep.name + ': Harvesting mineral ' + mineral.mineralType + ' in ' + creep.room.name);
        } else {
            logger.info(creep.name + ': Waiting at mineral ' + mineral.id + ' (cooldown or no minerals) in ' + creep.room.name);
            creep.moveTo(mineral, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    } 
    // Wenn der Creep voll ist, zum Storage bringen
    else if (creep.store.getFreeCapacity() === 0) {
        let resourceType = Object.keys(creep.store)[0]; // Erster gefundener Ressourcentyp (z. B. 'O')
        if (creep.transfer(storage, resourceType) === ERR_NOT_IN_RANGE) {
            creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
            logger.info(creep.name + ': Moving to storage to transfer ' + resourceType + ' in ' + creep.room.name);
        } else if (creep.transfer(storage, resourceType) === OK) {
            logger.info(creep.name + ': Transferring ' + resourceType + ' to storage in ' + creep.room.name);
        } else {
            logger.warn(creep.name + ': Transfer failed for ' + resourceType + ' in ' + creep.room.name);
        }
    } 
    // Wenn kein Mineral mehr da ist, warten
    else {
        creep.moveTo(mineral, { visualizePathStyle: { stroke: '#ffaa00' } });
        logger.info(creep.name + ': Waiting at mineral ' + mineral.id + ' (no minerals left) in ' + creep.room.name);
    }
};