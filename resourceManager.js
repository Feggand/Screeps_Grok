// resourceManager.js
// Modul zum Sammeln von Energie für Creeps, lokal oder remote

var logger = require('logger'); // Importiert Logging-Modul

module.exports = {
    // Hauptfunktion zum Sammeln von Energie, entscheidet zwischen lokal und remote
    collectEnergy: function(creep, homeRoom, targetRoom) {
        if (creep.room.name === homeRoom) {
            this.collectLocalEnergy(creep); // Sammelt lokal im Heimatraum
        } else if (targetRoom && creep.room.name === targetRoom) {
            this.collectRemoteEnergy(creep); // Sammelt im Zielraum
        } else if (targetRoom) {
            let targetRoomObj = Game.rooms[targetRoom]; // Zugriff auf Zielraum
            let hasEnergyContainers = targetRoomObj && targetRoomObj.find(FIND_STRUCTURES, {
                filter: function(s) { return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0; }
            }).length > 0; // Prüft, ob Container mit Energie im Zielraum existieren
            if (hasEnergyContainers) {
                // Bewegt sich zum Zielraum, wenn Energie verfügbar
                creep.moveTo(new RoomPosition(25, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            } else {
                // Bewegt sich zurück zum Heimatraum, wenn keine Energie
                creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            }
        } else {
            this.collectLocalEnergy(creep); // Fallback: Lokales Sammeln
        }
    },

    // Funktion zum lokalen Energiesammeln im Heimatraum
    collectLocalEnergy: function(creep) {
        // Spezielle Logik für Worker: Nur aus Storage
        if (creep.memory.role === 'worker') {
            let storage = creep.room.find(FIND_STRUCTURES, {
                filter: function(s) { return s.structureType === STRUCTURE_STORAGE && s.store[RESOURCE_ENERGY] > 0; }
            })[0]; // Findet Storage mit Energie
            if (storage && storage.store) {
                if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true }); // Bewegt sich zum Storage
                    logger.info(creep.name + ': Moving to storage at ' + storage.pos + ' for energy');
                } else {
                    logger.info(creep.name + ': Withdrawing energy from storage at ' + storage.pos); // Entnimmt Energie
                }
                return;
            }
        }

        // Für andere Rollen: Priorität auf abgeworfene Ressourcen
        let droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
            filter: function(r) { return r.resourceType === RESOURCE_ENERGY && r.amount > 0; }
        }, { avoidCreeps: true }); // Findet nächstgelegene abgeworfene Energie
        if (droppedEnergy && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                creep.moveTo(droppedEnergy, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true }); // Bewegt sich zur Energie
            }
            return; // Beendet Funktion nach Pickup
        }

        // Nächste Priorität: Tombstones mit Energie
        let tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
            filter: function(t) { return t.store[RESOURCE_ENERGY] > 0; }
        }, { avoidCreeps: true }); // Findet nächstgelegenen Tombstone
        if (tombstone && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(tombstone, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true }); // Bewegt sich zum Tombstone
            }
            return; // Beendet Funktion nach Withdraw
        }

        // Nächste Priorität: Container mit Energie
        let containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0; }
        }); // Findet alle Container mit Energie
        if (containers.length) {
            let targetContainer = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null; // Prüft gespeicherten Container
            if (!targetContainer || !targetContainer.store || targetContainer.store[RESOURCE_ENERGY] === 0) {
                let blockers = targetContainer ? targetContainer.pos.findInRange(FIND_MY_CREEPS, 1, {
                    filter: function(c) { return c.memory.role === 'hauler' && c.store.getFreeCapacity(RESOURCE_ENERGY) > 0; }
                }) : []; // Prüft, ob Hauler den Container blockieren
                if (blockers.length === 0 || creep.memory.role === 'worker') {
                    targetContainer = _.max(containers, function(c) { return c.store[RESOURCE_ENERGY]; }); // Wählt Container mit最多 Energie
                    creep.memory.containerId = targetContainer.id; // Speichert Container-ID
                    logger.info(creep.name + ': Assigned to container ' + targetContainer.id + ' at ' + targetContainer.pos);
                }
            }
            if (targetContainer && targetContainer.store) {
                if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true }); // Bewegt sich zum Container
                    logger.info(creep.name + ': Moving to container ' + targetContainer.id + ' at ' + targetContainer.pos);
                } else {
                    logger.info(creep.name + ': Withdrawing energy from container ' + targetContainer.id); // Entnimmt Energie
                }
            } else {
                let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true }); // Fallback: Nächster Spawn
                if (spawn && spawn.store) {
                    creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true }); // Bewegt sich zum Spawn
                    logger.info(creep.name + ': No container available, moving to spawn');
                }
            }
            return;
        }

        // Letzte Option: Bewegt sich zum Spawn, wenn keine Ressourcen verfügbar
        let spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS, { avoidCreeps: true });
        if (spawn) {
            creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
            logger.info(creep.name + ': No resources, moving to spawn');
        }
    },

    // Funktion zum Energiesammeln in einem Remote-Raum
    collectRemoteEnergy: function(creep) {
        let containers = creep.room.find(FIND_STRUCTURES, {
            filter: function(s) { return s.structureType === STRUCTURE_CONTAINER && s.store[RESOURCE_ENERGY] > 0; }
        }); // Findet Container mit Energie im Remote-Raum
        if (containers.length) {
            let targetContainer = creep.memory.containerId ? Game.getObjectById(creep.memory.containerId) : null; // Prüft gespeicherten Container
            if (!targetContainer || !targetContainer.store || targetContainer.store[RESOURCE_ENERGY] === 0) {
                targetContainer = _.max(containers, function(c) { return c.store[RESOURCE_ENERGY]; }); // Wählt Container mit最多 Energie
                creep.memory.containerId = targetContainer.id; // Speichert Container-ID
                logger.info(creep.name + ': Assigned to remote container ' + targetContainer.id + ' at ' + targetContainer.pos);
            }
            if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetContainer, { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true }); // Bewegt sich zum Container
            }
        } else {
            // Keine Container: Zurück zum Heimatraum
            let homeRoom = creep.memory.homeRoom || Object.keys(Game.rooms).find(function(r) { return Memory.rooms[r].isMyRoom; });
            creep.moveTo(new RoomPosition(25, 25, homeRoom), { visualizePathStyle: { stroke: '#ffaa00' }, avoidCreeps: true });
        }
    }
};