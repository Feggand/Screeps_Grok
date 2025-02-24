module.exports.run = function (creep) {
    // Entferne task und targetId, falls sie von anderer Logik stammen
    if (creep.memory.task || creep.memory.targetId) {
        console.log(`${creep.name}: Clearing worker-specific memory (task, targetId)`);
        delete creep.memory.task;
        delete creep.memory.targetId;
    }

    if (creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
    } else if (creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
    }

    let homeRoom = creep.memory.homeRoom || 'W6N1';

    if (creep.memory.working) {
        // Priorität 1: Controller upgraden
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
            creep.memory.task = 'upgrade';
            console.log(`${creep.name}: Moving to controller for upgrade, avoiding creeps`);
            return;
        }

        // Priorität 2: Bauen von Construction Sites
        let constructionSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if (constructionSite) {
            if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
                creep.moveTo(constructionSite, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                creep.memory.task = 'build';
                console.log(`${creep.name}: Moving to build ${constructionSite.structureType} at ${constructionSite.pos}, avoiding creeps`);
            }
            return;
        }

        // Priorität 3: Reparieren beschädigter Strukturen
        let damagedStructure = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) && s.hits < s.hitsMax
        });
        if (damagedStructure) {
            if (creep.repair(damagedStructure) === ERR_NOT_IN_RANGE) {
                creep.moveTo(damagedStructure, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                creep.memory.task = 'repair';
                console.log(`${creep.name}: Moving to repair ${damagedStructure.structureType} at ${damagedStructure.pos}, avoiding creeps`);
            }
            return;
        }

        console.log(`${creep.name}: No tasks, moving to spawn in ${homeRoom}, avoiding creeps`);
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
        }
    } else {
        // Energie sammeln, wenn kein Energie vorhanden
        let containers = creep.room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        if (containers.length) {
            let targetContainer = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
            if (!targetContainer || targetContainer.store[RESOURCE_ENERGY] === 0) {
                // Prüfe, ob Hauler den Container blockieren, bevor der Worker dorthin geht
                let nearbyHaulers = targetContainer ? targetContainer.pos.findInRange(FIND_MY_CREEPS, 1, {
                    filter: c => c.memory.role === 'hauler'
                }) : [];
                if (nearbyHaulers.length === 0) {
                    targetContainer = _.max(containers, c => c.store[RESOURCE_ENERGY]);
                    creep.memory.containerId = targetContainer.id;
                    console.log(`${creep.name}: Assigned to container ${targetContainer.id} in ${creep.room.name}, no haulers nearby`);
                } else {
                    console.log(`${creep.name}: Container ${targetContainer.id} blocked by haulers, finding alternative`);
                    // Suche nach einem alternativen Container
                    let alternativeContainers = containers.filter(c => !c.pos.findInRange(FIND_MY_CREEPS, 1, {
                        filter: h => h.memory.role === 'hauler'
                    }).length);
                    if (alternativeContainers.length) {
                        targetContainer = _.max(alternativeContainers, c => c.store[RESOURCE_ENERGY]);
                        creep.memory.containerId = targetContainer.id;
                        console.log(`${creep.name}: Assigned to alternative container ${targetContainer.id} in ${creep.room.name}`);
                    } else {
                        // Fallback: Suche nach fallengelassener Energie oder Tombstones
                        let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
                        }, { avoidCreeps: true });
                        if (droppedEnergy) {
                            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                                creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                                console.log(`${creep.name}: Picking up dropped energy at ${droppedEnergy.pos}, avoiding creeps`);
                            }
                            return;
                        }

                        let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                            filter: t => t.store[RESOURCE_ENERGY] > 0
                        }, { avoidCreeps: true });
                        if (tombstone) {
                            if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                                creep.moveTo(tombstone, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                                console.log(`${creep.name}: Withdrawing energy from tombstone at ${tombstone.pos}, avoiding creeps`);
                            }
                            return;
                        }

                        // Letzter Fallback: Bewege dich zum Spawn
                        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
                        if (spawn) {
                            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                            console.log(`${creep.name}: No containers available, moving to spawn in ${homeRoom}, avoiding creeps`);
                        } else {
                            console.log(`${creep.name}: No containers, resources, or spawn found in ${homeRoom}, waiting`);
                        }
                        return;
                    }
                }
            }
            if (targetContainer && creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                console.log(`${creep.name}: Moving to container ${targetContainer.id} in ${creep.room.name} for energy, avoiding creeps`);
            }
            return;
        }

        // Fallback: Suche nach fallengelassener Energie oder Tombstones
        let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
        }, { avoidCreeps: true });
        if (droppedEnergy) {
            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                console.log(`${creep.name}: Picking up dropped energy at ${droppedEnergy.pos}, avoiding creeps`);
            }
            return;
        }

        let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
            filter: t => t.store[RESOURCE_ENERGY] > 0
        }, { avoidCreeps: true });
        if (tombstone) {
            if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(tombstone, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                console.log(`${creep.name}: Withdrawing energy from tombstone at ${tombstone.pos}, avoiding creeps`);
            }
            return;
        }

        // Letzter Fallback: Bewege dich zum Spawn
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            console.log(`${creep.name}: No containers or resources, moving to spawn in ${homeRoom}, avoiding creeps`);
        } else {
            console.log(`${creep.name}: No containers, resources, or spawn found in ${homeRoom}, waiting`);
        }
    }
};