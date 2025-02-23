module.exports.run = function (creep) {
    if (creep.store[RESOURCE_ENERGY] === 0) {
        creep.memory.working = false;
        creep.memory.task = null;
        console.log(`${creep.name} in ${creep.room.name}: Energy empty, setting working=false`);
    } else if (creep.store.getFreeCapacity() === 0) {
        creep.memory.working = true;
        console.log(`${creep.name} in ${creep.room.name}: Energy full, setting working=true`);
    }

    let homeRoom = creep.memory.homeRoom || 'W6N1';
    let targetRoom = 'W7N1';
    let room = creep.room;
    let workers = _.sortBy(_.filter(Game.creeps, c => c.memory.role === 'worker' && (c.memory.homeRoom === homeRoom || c.room.name === homeRoom)), 'id');

    console.log(`${creep.name} in ${room.name}: working=${creep.memory.working}, task=${creep.memory.task}`);

    if (creep.memory.working) {
        let isPrimaryUpgrader = workers[0].id === creep.id;
        if (isPrimaryUpgrader) {
            if (room.name === homeRoom) {
                creep.memory.task = 'upgrade';
                if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(room.controller, { visualizePathStyle: { stroke: '#00ff00' } });
                    console.log(`${creep.name}: Moving to controller in ${homeRoom}`);
                }
            } else {
                creep.moveTo(new RoomPosition(31, 42, homeRoom), { visualizePathStyle: { stroke: '#00ff00' } });
                console.log(`${creep.name}: Returning to ${homeRoom} (31,42) as primary upgrader`);
            }
            return;
        }

        let isPrimaryRepairer = workers.length > 1 && workers[1].id === creep.id;
        if (isPrimaryRepairer) {
            if (room.name === homeRoom) {
                let damagedStructures = room.find(FIND_STRUCTURES, {
                    filter: s => (
                        (s.structureType === STRUCTURE_ROAD ||
                            s.structureType === STRUCTURE_CONTAINER ||
                            s.structureType === STRUCTURE_RAMPART) &&
                        s.hits < s.hitsMax
                    )
                });
                if (damagedStructures.length) {
                    let target = creep.pos.findClosestByPath(damagedStructures);
                    creep.memory.task = 'repair';
                    creep.memory.targetId = target.id;
                    if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
                        console.log(`${creep.name}: Moving to repair ${target.structureType} at ${target.pos}`);
                    }
                } else {
                    creep.memory.task = 'upgrade';
                    if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(room.controller, { visualizePathStyle: { stroke: '#00ff00' } });
                        console.log(`${creep.name}: Moving to controller for upgrade`);
                    }
                }
            } else {
                creep.moveTo(new RoomPosition(31, 42, homeRoom), { visualizePathStyle: { stroke: '#00ff00' } });
                console.log(`${creep.name}: Returning to ${homeRoom} (31,42) as primary repairer`);
            }
            return;
        }

        if (Game.rooms[targetRoom]) {
            let remoteConstructionSites = Game.rooms[targetRoom].find(FIND_CONSTRUCTION_SITES);
            if (remoteConstructionSites.length > 0) {
                if (creep.room.name !== targetRoom) {
                    console.log(`${creep.name} in ${room.name}: Bewege nach ${targetRoom} (10,10) für Baustellen (Sicht)`);
                    creep.moveTo(new RoomPosition(10, 10, targetRoom), { visualizePathStyle: { stroke: '#0000ff' } });
                } else {
                    let target = creep.pos.findClosestByPath(remoteConstructionSites);
                    if (target) {
                        creep.memory.task = 'build';
                        console.log(`${creep.name} in ${room.name}: Baue ${target.structureType} bei ${target.pos}`);
                        if (creep.build(target) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(target, { visualizePathStyle: { stroke: '#0000ff' } });
                        }
                    } else {
                        console.log(`${creep.name} in ${room.name}: Keine erreichbare Baustelle in ${targetRoom}, zurück nach ${homeRoom} (31,42)`);
                        creep.moveTo(new RoomPosition(31, 42, homeRoom), { visualizePathStyle: { stroke: '#00ff00' } });
                    }
                }
                return;
            }
        } else if (Memory.rooms[homeRoom] && Memory.rooms[homeRoom].remoteContainersBuilt) {
            if (creep.room.name !== targetRoom) {
                console.log(`${creep.name} in ${room.name}: Bewege nach ${targetRoom} (10,10) für Baustellen (keine Sicht, Memory)`);
                creep.moveTo(new RoomPosition(10, 10, targetRoom), { visualizePathStyle: { stroke: '#0000ff' } });
                return;
            }
        }

        if (room.name === homeRoom) {
            let constructionSites = room.find(FIND_CONSTRUCTION_SITES);
            if (constructionSites.length) {
                let target = creep.pos.findClosestByPath(constructionSites);
                if (target) {
                    creep.memory.task = 'build';
                    if (creep.build(target) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, { visualizePathStyle: { stroke: '#0000ff' } });
                        console.log(`${creep.name}: Moving to build ${target.structureType} at ${target.pos}`);
                    }
                } else {
                    creep.memory.task = 'upgrade';
                    if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(room.controller, { visualizePathStyle: { stroke: '#00ff00' } });
                        console.log(`${creep.name}: Moving to controller for upgrade`);
                    }
                }
            } else {
                creep.memory.task = 'upgrade';
                if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(room.controller, { visualizePathStyle: { stroke: '#00ff00' } });
                    console.log(`${creep.name}: Moving to controller for upgrade`);
                }
            }
        } else {
            creep.moveTo(new RoomPosition(31, 42, homeRoom), { visualizePathStyle: { stroke: '#00ff00' } });
            console.log(`${creep.name}: Returning to ${homeRoom} (31,42)`);
        }
    } else {
        let containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
        });
        if (containers.length) {
            let fullestContainer = _.max(containers, c => c.store[RESOURCE_ENERGY]);
            let targetContainer = containers.every(c => c.store[RESOURCE_ENERGY] === c.store.getCapacity(RESOURCE_ENERGY)) ? creep.pos.findClosestByPath(containers) : fullestContainer;
            if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' } });
                console.log(`${creep.name}: Moving to container at ${targetContainer.pos} in ${room.name}`);
            }
        } else if (room.name !== homeRoom) {
            creep.moveTo(new RoomPosition(31, 42, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
            console.log(`${creep.name}: No containers, returning to ${homeRoom} (31,42)`);
        } else {
            console.log(`${creep.name}: No containers in ${homeRoom}, waiting`);
        }
    }
};