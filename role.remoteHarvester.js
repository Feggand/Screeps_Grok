var logger = require('logger');

module.exports.run = function (creep) {
    let targetRoom = creep.memory.targetRoom;
    if (!targetRoom) {
        logger.warn(`${creep.name}: No targetRoom, skipping`);
        return;
    }

    if (creep.room.name !== targetRoom) {
        creep.moveTo(new RoomPosition(26, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        return;
    }

    if (!creep.memory.containerId) {
        let containers = creep.room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
        if (containers.length) {
            let freeContainer = containers.find(c => !Memory.remoteContainers[targetRoom]?.some(rc => rc.id === c.id && rc.assignedHarvester));
            if (freeContainer) {
                creep.memory.containerId = freeContainer.id;
                if (!Memory.remoteContainers[targetRoom]) Memory.remoteContainers[targetRoom] = [];
                let existing = Memory.remoteContainers[targetRoom].find(rc => rc.id === freeContainer.id);
                if (!existing) {
                    Memory.remoteContainers[targetRoom].push({ id: freeContainer.id, assignedHarvester: creep.name });
                } else {
                    existing.assignedHarvester = creep.name;
                }
                logger.info(`${creep.name}: Assigned to container ${freeContainer.id}`);
            }
        }
        return;
    }

    if (creep.store.getFreeCapacity() > 0) {
        let source = creep.pos.findClosestByRange(FIND_SOURCES);
        if (!source) {
            logger.warn(`${creep.name}: No source found in ${targetRoom}`);
            return;
        }
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    } else {
        let container = Game.getObjectById(creep.memory.containerId);
        if (container) {
            if (creep.transfer(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        } else {
            creep.drop(RESOURCE_ENERGY);
            logger.warn(`${creep.name}: Container ${creep.memory.containerId} not found, dropping energy`);
        }
    }
};