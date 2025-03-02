// role.remoteHarvester.js
// Logik für RemoteHarvester-Creeps, die in Remote-Räumen Energie abbauen

var logger = require('logger'); // Importiert Logging-Modul

module.exports.run = function (creep) {
    let targetRoom = creep.memory.targetRoom; // Zielraum aus Speicher
    if (!targetRoom) {
        logger.warn(`${creep.name}: No targetRoom, skipping`); // Kein Zielraum -> überspringen
        return;
    }

    if (creep.room.name !== targetRoom) {
        // Bewegt sich zum Zielraum, wenn nicht bereits dort
        creep.moveTo(new RoomPosition(26, 25, targetRoom), { visualizePathStyle: { stroke: '#ffaa00' } });
        return;
    }

    // Weist einen Container zu, wenn noch keiner zugewiesen ist
    if (!creep.memory.containerId) {
        let containers = creep.room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_CONTAINER }); // Findet alle Container
        if (containers.length) {
            let freeContainer = containers.find(c => !Memory.remoteContainers[targetRoom]?.some(rc => rc.id === c.id && rc.assignedHarvester)); // Freier Container
            if (freeContainer) {
                creep.memory.containerId = freeContainer.id; // Speichert Container-ID
                if (!Memory.remoteContainers[targetRoom]) Memory.remoteContainers[targetRoom] = []; // Initialisiert Remote-Container-Array
                let existing = Memory.remoteContainers[targetRoom].find(rc => rc.id === freeContainer.id); // Prüft vorhandenen Eintrag
                if (!existing) {
                    Memory.remoteContainers[targetRoom].push({ id: freeContainer.id, assignedHarvester: creep.name }); // Neuer Eintrag
                } else {
                    existing.assignedHarvester = creep.name; // Aktualisiert Zuweisung
                }
                logger.info(`${creep.name}: Assigned to container ${freeContainer.id}`);
            }
        }
        return; // Wartet auf Container-Zuweisung
    }

    if (creep.store.getFreeCapacity() > 0) { // Wenn Platz für Energie
        let source = creep.pos.findClosestByRange(FIND_SOURCES); // Nächstgelegene Quelle
        if (!source) {
            logger.warn(`${creep.name}: No source found in ${targetRoom}`); // Keine Quelle -> Warnung
            return;
        }
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } }); // Bewegt sich zur Quelle
        }
    } else { // Creep ist voll
        let container = Game.getObjectById(creep.memory.containerId); // Zugewiesener Container
        if (container) {
            if (creep.transfer(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, { visualizePathStyle: { stroke: '#ffffff' } }); // Bewegt sich zum Container
            }
        } else {
            creep.drop(RESOURCE_ENERGY); // Container nicht gefunden -> Energie abwerfen
            logger.warn(`${creep.name}: Container ${creep.memory.containerId} not found, dropping energy`);
        }
    }
};