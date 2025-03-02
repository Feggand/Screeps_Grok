// role.remoteHarvester.js
// Logik für RemoteHarvester-Creeps, die in Remote-Räumen unbesetzte Quellen abbauen

var logger = require('logger');

var roleRemoteHarvester = {
    run: function(creep) {
        logger.info(`${creep.name}: Starting run function`);

        let targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            logger.warn(`${creep.name}: No targetRoom assigned, skipping`);
            return;
        }

        if (creep.room.name !== targetRoom) {
            logger.info(`${creep.name}: Moving to target room ${targetRoom}`);
            creep.moveTo(new RoomPosition(26, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
            return;
        }

        const room = Game.rooms[targetRoom];
        if (!room) {
            logger.warn(`${creep.name}: Target room ${targetRoom} not visible, skipping`);
            return;
        }

        const sources = room.find(FIND_SOURCES);
        logger.info(`${creep.name}: Found ${sources.length} sources in ${targetRoom}`);
        const assignedSources = _.map(_.filter(Game.creeps, c => c.memory.role === 'remoteHarvester' && c.memory.targetRoom === targetRoom && c.id !== creep.id), 'memory.sourceId');
        const targetSource = sources.find(source => !assignedSources.includes(source.id));

        if (!targetSource) {
            logger.warn(`${creep.name}: No unassigned sources in ${targetRoom}, idling`);
            const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
            if (spawn) {
                logger.info(`${creep.name}: Moving to spawn ${spawn.id} for idling`);
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        if (!creep.memory.sourceId) {
            creep.memory.sourceId = targetSource.id;
            logger.info(`${creep.name}: Assigned to source ${targetSource.id} in ${targetRoom}`);
        }

        // Container-Logik
        if (!creep.memory.containerId) {
            let containers = room.find(FIND_STRUCTURES, { 
                filter: s => s.structureType === STRUCTURE_CONTAINER && s.pos.inRangeTo(targetSource, 2)
            });
            logger.info(`${creep.name}: Found ${containers.length} containers near source in ${targetRoom}`);
            let freeContainer = containers[0]; // Bevorzuge den ersten existierenden Container
            if (freeContainer) {
                creep.memory.containerId = freeContainer.id;
                if (!Memory.remoteContainers) Memory.remoteContainers = {};
                if (!Memory.remoteContainers[targetRoom]) Memory.remoteContainers[targetRoom] = [];
                let existing = Memory.remoteContainers[targetRoom].find(rc => rc.id === freeContainer.id);
                if (!existing) {
                    Memory.remoteContainers[targetRoom].push({ id: freeContainer.id, assignedHarvester: creep.name });
                } else {
                    existing.assignedHarvester = creep.name; // Überschreibe nur, wenn nötig
                }
                logger.info(`${creep.name}: Assigned to existing container ${freeContainer.id}`);
            } else if (room.controller && (room.controller.my || (room.controller.reservation && room.controller.reservation.username === creep.owner.username))) {
                logger.info(`${creep.name}: Room reserved, attempting to build container`);
                this.buildContainerNearSource(creep, targetSource);
                return;
            } else {
                logger.warn(`${creep.name}: Room ${targetRoom} not reserved, harvesting without container`);
            }
        }

        const container = Game.getObjectById(creep.memory.containerId);
        if (container) {
            // Positioniere Creep auf dem Container
            if (!creep.pos.isEqualTo(container.pos)) {
                logger.info(`${creep.name}: Moving to container ${container.id} to position`);
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ffffff' } });
                return;
            }

            // Repariere Container direkt, wenn nötig (kein withdraw nötig, Energie wird vom Container genommen)
            if (container.hits < container.hitsMax * 0.8 && container.store[RESOURCE_ENERGY] > 0) {
                if (creep.repair(container) === OK) {
                    logger.info(`${creep.name}: Repairing container ${container.id}`);
                } else {
                    logger.warn(`${creep.name}: Repairing container ${container.id} failed with code ${creep.repair(container)}`);
                }
            }

            // Ernte von der Quelle
            const source = Game.getObjectById(creep.memory.sourceId);
            if (!source) {
                logger.error(`${creep.name}: Source ${creep.memory.sourceId} not found`);
                delete creep.memory.sourceId;
                return;
            }
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                logger.info(`${creep.name}: Moving to source ${source.id} to harvest`);
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            } else if (creep.harvest(source) === OK) {
                logger.info(`${creep.name}: Harvesting source ${source.id}`);
            } else {
                logger.warn(`${creep.name}: Harvesting source ${source.id} failed with code ${creep.harvest(source)}`);
            }
        } else {
            // Ohne Container: Normales Ernten
            if (creep.store.getFreeCapacity() > 0) {
                const source = Game.getObjectById(creep.memory.sourceId);
                if (!source) {
                    logger.error(`${creep.name}: Source ${creep.memory.sourceId} not found`);
                    delete creep.memory.sourceId;
                    return;
                }
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    logger.info(`${creep.name}: Moving to source ${source.id} to harvest`);
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                } else if (creep.harvest(source) === OK) {
                    logger.info(`${creep.name}: Harvesting source ${source.id}`);
                } else {
                    logger.warn(`${creep.name}: Harvesting source ${source.id} failed with code ${creep.harvest(source)}`);
                }
            } else {
                logger.warn(`${creep.name}: No container assigned, dropping energy`);
                creep.drop(RESOURCE_ENERGY);
            }
        }
    },

    buildContainerNearSource: function(creep, source) {
        const site = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 2, { 
            filter: s => s.structureType === STRUCTURE_CONTAINER 
        })[0];
        if (!site && creep.store[RESOURCE_ENERGY] > 0) {
            const positions = [
                { x: source.pos.x, y: source.pos.y + 1 },
                { x: source.pos.x, y: source.pos.y - 1 },
                { x: source.pos.x + 1, y: source.pos.y },
                { x: source.pos.x - 1, y: source.pos.y },
                { x: source.pos.x + 1, y: source.pos.y + 1 },
                { x: source.pos.x - 1, y: source.pos.y - 1 },
                { x: source.pos.x + 1, y: source.pos.y - 1 },
                { x: source.pos.x - 1, y: source.pos.y + 1 }
            ];
            for (let pos of positions) {
                if (pos.x >= 0 && pos.x < 50 && pos.y >= 0 && pos.y < 50) {
                    const terrain = creep.room.lookForAt(LOOK_TERRAIN, pos.x, pos.y)[0];
                    const structures = creep.room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                    if (terrain !== 'wall' && structures.length === 0) {
                        const result = creep.room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
                        if (result === OK) {
                            logger.info(`${creep.name}: Creating container at ${pos.x},${pos.y} near source ${source.id}`);
                            return;
                        } else {
                            logger.warn(`${creep.name}: Failed to create container at ${pos.x},${pos.y}: ${result}`);
                        }
                    }
                }
            }
            logger.warn(`${creep.name}: No valid position found for container near ${source.id}, harvesting instead`);
        } else if (site) {
            if (creep.build(site) === ERR_NOT_IN_RANGE) {
                logger.info(`${creep.name}: Moving to build container at ${site.pos}`);
                creep.moveTo(site, { visualizePathStyle: { stroke: '#0000ff' } });
            } else if (creep.build(site) === OK) {
                logger.info(`${creep.name}: Building container at ${site.pos}`);
            } else {
                logger.warn(`${creep.name}: Building container at ${site.pos} failed with code ${creep.build(site)}`);
            }
        }

        // Fallback: Ernte weiter, auch wenn kein Container gebaut wird
        if (creep.store.getFreeCapacity() > 0) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                logger.info(`${creep.name}: Moving to source ${source.id} to harvest`);
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            } else if (creep.harvest(source) === OK) {
                logger.info(`${creep.name}: Harvesting source ${source.id}`);
            }
        }
    }
};

module.exports = roleRemoteHarvester;