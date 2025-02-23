module.exports.run = function (creep) {
    if (creep.room.name !== creep.memory.targetRoom) {
        creep.moveTo(new RoomPosition(26, 25, creep.memory.targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        return;
    }

    if (!creep.memory.containerId) {
        let containers = creep.room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER });
        if (containers.length) {
            let freeContainer = containers.find(c => !Memory.remoteContainers[creep.memory.targetRoom].some(rc => rc.id === c.id && rc.assignedHarvester));
            if (freeContainer) {
                creep.memory.containerId = freeContainer.id;
                if (!Memory.remoteContainers[creep.memory.targetRoom].some(rc => rc.id === freeContainer.id)) {
                    Memory.remoteContainers[creep.memory.targetRoom].push({ id: freeContainer.id, assignedHarvester: creep.name });
                } else {
                    Memory.remoteContainers[creep.memory.targetRoom].find(rc => rc.id === freeContainer.id).assignedHarvester = creep.name;
                }
            }
        }
        return;
    }

    if (creep.store.getFreeCapacity() > 0) {
        let source = creep.pos.findClosestByRange(FIND_SOURCES);
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
        }
    }
};