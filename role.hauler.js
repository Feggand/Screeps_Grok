module.exports.run = function (creep) {
    // Entferne task und targetId, falls sie von Worker-Logik stammen
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
    let targetRoom = 'W7N1';
    let room = creep.room;

    console.log(`${creep.name} in ${room.name}: working=${creep.memory.working}, energy=${creep.store[RESOURCE_ENERGY]}/${creep.store.getCapacity(RESOURCE_ENERGY)}`);

    if (creep.memory.working) {
        // Priorität 1: Spawns und Extensions füllen
        let primaryTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => (
                (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            )
        });
        if (primaryTarget) {
            if (creep.transfer(primaryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(primaryTarget, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                console.log(`${creep.name}: Moving to transfer energy to ${primaryTarget.structureType} at ${primaryTarget.pos}, avoiding creeps`);
            }
            return;
        }

        // Priorität 2: Türme füllen
        let secondaryTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => (
                s.structureType === STRUCTURE_TOWER &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            )
        });
        if (secondaryTarget) {
            if (creep.transfer(secondaryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(secondaryTarget, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                console.log(`${creep.name}: Moving to transfer energy to tower at ${secondaryTarget.pos}, avoiding creeps`);
            }
            return;
        }

        // Priorität 3: Storage füllen (falls vorhanden)
        let storage = room.find(FIND_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_STORAGE && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        })[0];
        if (storage) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' }, avoidCreeps: true });
                console.log(`${creep.name}: Moving to transfer energy to storage at ${storage.pos}, avoiding creeps`);
            }
            return;
        }

        // Fallback für Hauler mit voller Energie: Suche nach Ressourcen, überwache Container nur, wenn nötig, dann zum Spawn
        console.log(`${creep.name}: No structures need energy, checking local tasks in ${homeRoom}`);
        if (room.name === homeRoom) {
            // Priorität 4: Fallengelassene Energie aufheben
            let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
            });
            if (droppedEnergy && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    console.log(`${creep.name}: Picking up dropped energy at ${droppedEnergy.pos}, avoiding creeps`);
                }
                return;
            }

            // Priorität 5: Tombstones leeren
            let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                filter: t => t.store[RESOURCE_ENERGY] > 0
            });
            if (tombstone && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(tombstone, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    console.log(`${creep.name}: Withdrawing energy from tombstone at ${tombstone.pos}, avoiding creeps`);
                }
                return;
            }

            // Priorität 6: Überprüfe Container nur, wenn Energie vorhanden ist, sonst zum Spawn
            let containers = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
            });
            if (containers.length) {
                let targetContainer = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
                if (!targetContainer || targetContainer.store[RESOURCE_ENERGY] === 0) {
                    console.log(`${creep.name}: Checking containers in ${homeRoom}, found ${containers.length} with energy`);
                    targetContainer = _.max(containers, c => c.store[RESOURCE_ENERGY]);
                    creep.memory.containerId = targetContainer.id;
                    console.log(`${creep.name}: Assigned to container ${targetContainer.id} in ${room.name}`);
                }
                if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    console.log(`${creep.name}: Moving to container ${targetContainer.id} in ${room.name} for energy, avoiding creeps`);
                }
                return;
            }

            // Letzter Fallback: Bewege dich zum Spawn, um in der Nähe von potenziellen Zielen zu bleiben
            let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
            if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                console.log(`${creep.name}: No tasks, moving to spawn in ${homeRoom}, avoiding creeps`);
            } else {
                console.log(`${creep.name}: No spawn, containers, or tasks found in ${homeRoom}, waiting`);
            }
        }
    } else {
        // Prüfe, ob der Hauler in homeRoom ist oder zurückgekehrt ist
        if (room.name === homeRoom) {
            console.log(`${creep.name} in ${homeRoom}: Checking local tasks`);

            // Priorität 1: Fallengelassene Energie aufheben
            let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
            }, { avoidCreeps: true });
            if (droppedEnergy && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    console.log(`${creep.name}: Picking up dropped energy at ${droppedEnergy.pos}, avoiding creeps`);
                }
                return;
            }

            // Priorität 2: Tombstones leeren
            let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                filter: t => t.store[RESOURCE_ENERGY] > 0
            }, { avoidCreeps: true });
            if (tombstone && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(tombstone, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    console.log(`${creep.name}: Withdrawing energy from tombstone at ${tombstone.pos}, avoiding creeps`);
                }
                return;
            }

            // Priorität 3: Lokale Container leeren
            let containers = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
            });
            if (containers.length) {
                let targetContainer = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
                if (!targetContainer || targetContainer.store[RESOURCE_ENERGY] === 0) {
                    console.log(`${creep.name}: Checking containers in ${homeRoom}, found ${containers.length} with energy`);
                    // Prüfe, ob ein Worker in der Nähe des Containers ist, bevor der Hauler dorthin geht
                    let nearbyWorkers = targetContainer ? targetContainer.pos.findInRange(FIND_MY_CREEPS, 1, {
                        filter: c => c.memory.role === 'worker' && c.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    }) : [];
                    if (nearbyWorkers.length === 0) {
                        targetContainer = _.max(containers, c => c.store[RESOURCE_ENERGY]);
                        creep.memory.containerId = targetContainer.id;
                        console.log(`${creep.name}: Assigned to container ${targetContainer.id} in ${room.name}, no workers nearby`);
                    } else {
                        console.log(`${creep.name}: Container ${targetContainer.id} blocked by workers, skipping`);
                        targetContainer = null; // Container überspringen, wenn Workers blockiert sind
                    }
                }
                if (targetContainer && creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    console.log(`${creep.name}: Moving to container ${targetContainer.id} in ${room.name} for energy, avoiding creeps`);
                }
                return;
            }

            // Letzter Fallback: Bewege dich zum Spawn, um in der Nähe von potenziellen Zielen zu bleiben
            let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
            if (spawn) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                console.log(`${creep.name}: No tasks, moving to spawn in ${homeRoom}, avoiding creeps`);
            } else {
                console.log(`${creep.name}: No spawn, containers, or tasks found in ${homeRoom}, waiting`);
            }
        } else {
            // Priorität 1: Fallengelassene Energie aufheben (im aktuellen Raum)
            let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: r => r.resourceType === RESOURCE_ENERGY && r.amount > 0
            }, { avoidCreeps: true });
            if (droppedEnergy && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    console.log(`${creep.name}: Picking up dropped energy at ${droppedEnergy.pos}, avoiding creeps`);
                }
                return;
            }

            // Priorität 2: Tombstones leeren (im aktuellen Raum)
            let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                filter: t => t.store[RESOURCE_ENERGY] > 0
            }, { avoidCreeps: true });
            if (tombstone && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(tombstone, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    console.log(`${creep.name}: Withdrawing energy from tombstone at ${tombstone.pos}, avoiding creeps`);
                }
                return;
            }

            // Priorität 3: Remote-Container leeren (nur wenn Container mit Energie vorhanden)
            if (Game.rooms[targetRoom]) {
                let remoteContainers = Game.rooms[targetRoom].find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
                });
                if (remoteContainers.length > 0 && creep.room.name === targetRoom) {
                    let targetContainer = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null;
                    if (!targetContainer || targetContainer.store[RESOURCE_ENERGY] === 0) {
                        targetContainer = _.max(remoteContainers, c => c.store[RESOURCE_ENERGY]);
                        creep.memory.containerId = targetContainer.id;
                        console.log(`${creep.name}: Assigned to container ${targetContainer.id} in ${targetRoom}`);
                    }
                    if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                        console.log(`${creep.name}: Moving to container ${targetContainer.id} in ${targetRoom} for energy, avoiding creeps`);
                    }
                    return;
                } else if (remoteContainers.length === 0 && creep.room.name === targetRoom) {
                    // Keine Container mit Energie in W7N1 – zurück nach W6N1 und lokale Aufgaben übernehmen
                    creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                    console.log(`${creep.name}: No containers with energy in ${targetRoom}, returning to local tasks in ${homeRoom}, avoiding creeps`);
                    return;
                } else if (creep.room.name !== targetRoom) {
                    // Prüfe, ob überhaupt Container mit Energie in W7N1 existieren, bevor wir hingehen
                    let hasEnergyContainers = Game.rooms[targetRoom] && Game.rooms[targetRoom].find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0
                    }).length > 0;
                    if (hasEnergyContainers) {
                        creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                        console.log(`${creep.name}: Moving to ${targetRoom} (25,25) for remote containers with energy, avoiding creeps`);
                    } else {
                        // Keine Container mit Energie – lokale Aufgaben übernehmen
                        creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
                        console.log(`${creep.name}: No containers with energy in ${targetRoom}, returning to local tasks in ${homeRoom}, avoiding creeps`);
                    }
                    return;
                }
            }
        }
    }
};