// role.link.js
// Logik für Link-Strukturen, die Energie zwischen Räumen transportieren

var logger = require('logger'); // Importiert Logging-Modul

module.exports.run = function() {
    // Durchläuft alle sichtbaren Räume
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue; // Überspringt Räume, die nicht mir gehören

        let links = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK }); // Findet alle Links im Raum
        if (links.length < 2) continue; // Benötigt mindestens 2 Links (Sender und Receiver)

        // Variablen für Sender- und Receiver-Link
        let senderLink = null;
        let receiverLink = null;
        let storage = room.storage; // Raum-Storage
        let controllerContainer = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        })[0]; // Container nahe dem Controller

        // Bestimmt Sender (nahe Storage) und Receiver (nahe Controller-Container)
        links.forEach(link => {
            if (storage && link.pos.getRangeTo(storage) <= 2) {
                senderLink = link; // Link nahe dem Storage ist Sender
            } else if (controllerContainer && link.pos.getRangeTo(controllerContainer) <= 2) {
                receiverLink = link; // Link nahe dem Controller-Container ist Receiver
            }
        });

        // Überträgt Energie, wenn Bedingungen erfüllt
        if (senderLink && receiverLink && senderLink.store[RESOURCE_ENERGY] >= 200 && senderLink.cooldown === 0) {
            let result = senderLink.transferEnergy(receiverLink); // Überträgt Energie vom Sender zum Receiver
            if (result === OK) {
                logger.info('Transferred energy from link at ' + senderLink.pos + ' to link at ' + receiverLink.pos + ' in ' + room.name);
            } else {
                logger.warn('Failed to transfer energy from link ' + senderLink.id + ' to ' + receiverLink.id + ': ' + result); // Fehler protokollieren
            }
        }
    }
};