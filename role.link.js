// role.link.js
var logger = require('logger');

module.exports.run = function() {
    for (let roomName in Game.rooms) {
        let room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;

        let links = room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });
        if (links.length < 2) continue;

        // Finde Sender (nahe dem Storage) und Receiver (nahe dem Controller-Container)
        let senderLink = null;
        let receiverLink = null;
        let storage = room.storage;
        let controllerContainer = room.controller.pos.findInRange(FIND_STRUCTURES, 3, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        })[0];

        links.forEach(link => {
            if (storage && link.pos.getRangeTo(storage) <= 2) {
                senderLink = link; // Link nahe dem Storage ist Sender
            } else if (controllerContainer && link.pos.getRangeTo(controllerContainer) <= 2) {
                receiverLink = link; // Link nahe dem Controller-Container ist Receiver
            }
        });

        if (senderLink && receiverLink && senderLink.store[RESOURCE_ENERGY] >= 200 && senderLink.cooldown === 0) {
            let result = senderLink.transferEnergy(receiverLink);
            if (result === OK) {
                logger.info('Transferred energy from link at ' + senderLink.pos + ' to link at ' + receiverLink.pos + ' in ' + room.name);
            } else {
                logger.warn('Failed to transfer energy from link ' + senderLink.id + ' to ' + receiverLink.id + ': ' + result);
            }
        }
    }
};