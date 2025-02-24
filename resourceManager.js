var logger = require('logger');

module.exports = {
    collectEnergy: function(creep, homeRoom, targetRoom) {
        if (creep.room.name === homeRoom) {
            this.collectLocalEnergy(creep);
        } else if (targetRoom && creep.room.name === targetRoom) {
            this.collectRemoteEnergy(creep);
        } else if (targetRoom) {
            let targetRoomObj = Game.rooms[targetRoom];
            let hasEnergyContainers = targetRoomObj && targetRoomObj.find(FIND_STRUCTURES, {
                filter: function(s) { return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0; }
            }).length > 0;
            if (hasEnergyContainers) {
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            } else {
                creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            }
        } else {
            this.collectLocalEnergy(creep);
        }
    },

    collectLocalEnergy: function(creep) {
        // Für Worker: Nur Storage
        if (creep.memory.role === 'worker') {
            let storage = creep.room.find(FIND_STRUCTURES, {
                filter: function(s) { return s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0; }
            })[0];
            if (storage) {
                if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    logger.info(creep.name + ': Moving to storage at ' + storage.pos + ' for energy');
                } else {
                    logger.info(creep.name + ': Withdrawing energy from storage at ' + storage.pos);
                }
                return;
            }
        }

        // Für andere Rollen (z. B. Hauler)
        let containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0; }
        });
        if (containers.length) {
            let targetContainer = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
            if (!targetContainer || !targetContainer.store || targetContainer.store[RESOURCE_ENERGY] === 0) {
                let blockers = targetContainer ? targetContainer.pos.findInRange(FIND_MY_CREEPS, 1, {
                    filter: function(c) { return c.memory.role === 'hauler' && c.store.getFreeCapacity(RESOURCE_ENERGY) > 0; }
                }) : [];
                if (blockers.length === 0 || creep.memory.role === 'worker') {
                    targetContainer = _.max(containers, function(c) { return c.store[RESOURCE_ENERGY]; });
                    creep.memory.containerId = targetContainer.id;
                    logger.info(creep.name + ': Assigned to container ' + targetContainer.id + ' at ' + targetContainer.pos);
                }
            }
            if (targetContainer) {
                if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    logger.info(creep.name + ': Moving to container ' + targetContainer.id + ' at ' + targetContainer.pos);
                } else {
                    logger.info(creep.name + ': Withdrawing energy from container ' + targetContainer.id);
                }
            } else {
                let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
                if (spawn) {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    logger.info(creep.name + ': No container available, moving to spawn');
                }
            }
            return;
        }

        let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: function(r) { return r.resourceType === RESOURCE_ENERGY && r.amount > 0; }
        }, { avoidCreeps: true });
        if (droppedEnergy && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            }
            return;
        }

        let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
            filter: function(t) { return t.store[RESOURCE_ENERGY] > 0; }
        }, { avoidCreeps: true });
        if (tombstone && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(tombstone, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            }
            return;
        }

        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            logger.info(creep.name + ': No resources, moving to spawn');
        }
    },

    collectRemoteEnergy: function(creep) {
        let containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0; }
        });
        if (containers.length) {
            let targetContainer = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
            if (!targetContainer || !targetContainer.store || targetContainer.store[RESOURCE_ENERGY] === 0) {
                targetContainer = _.max(containers, function(c) { return c.store[RESOURCE_ENERGY]; });
                creep.memory.containerId = targetContainer.id;
                logger.info(creep.name + ': Assigned to remote container ' + targetContainer.id + ' at ' + targetContainer.pos);
            }
            if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            }
        } else {
            let homeRoom = creep.memory.homeRoom || Object.keys(Game.rooms).find(function(r) { return Memory.rooms[r].isMyRoom; });
            creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
        }
    }
};