module.exports.run = function (creep) {
    if (creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
    } else if (creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
    }

    let haulers = _.filter(Game.creeps, c => c.memory.role === 'hauler' && c.room.name === creep.room.name);
    let isPrimaryHauler = haulers.length === 1 || haulers[0].id === creep.id;

    if (isPrimaryHauler) {
        let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
        });
        if (droppedEnergy && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
            filter: t => t.store[RESOURCE_ENERGY] > 0
        });
        if (tombstone && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(tombstone, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }
    }

    if (creep.memory.working) {
        let primaryTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => (
                (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            )
        });
        if (primaryTarget) {
            if (creep.transfer(primaryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(primaryTarget, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        let secondaryTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => (
                s.structureType === STRUCTURE_TOWER &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            )
        });
        if (secondaryTarget) {
            if (creep.transfer(secondaryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(secondaryTarget, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }
    } else {
        // Container in W7N1 leeren
        let targetRoom = 'W7N1';
        if (Game.rooms[targetRoom]) {
            let remoteContainers = Game.rooms[targetRoom].find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
            });
            if (remoteContainers.length) {
                let targetContainer = creep.pos.findClosestByPath(remoteContainers);
                if (creep.room.name !== targetRoom) {
                    creep.moveTo(new RoomPosition(targetContainer.pos.x, targetContainer.pos.y, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
                return;
            }
        }

        // Lokale Container als Fallback
        let containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        if (containers.length) {
            let fullestContainer = _.max(containers, c => c.store[RESOURCE_ENERGY]);
            let allFull = containers.every(c => c.store[RESOURCE_ENERGY] === c.store.getCapacity(RESOURCE_ENERGY));
            let targetContainer = allFull ? creep.pos.findClosestByPath(containers) : fullestContainer;
            if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    }
};