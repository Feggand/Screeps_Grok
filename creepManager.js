var logger = require('logger');

module.exports = {
    runCreeps: function() {
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            let role = creep.memory.role;
            if (!role || typeof role !== 'string' || role === 'undefined') {
                logger.warn(`Invalid or undefined role for creep ${name}, determining role from body`);
                if (this.determineRole(creep)) {
                    role = creep.memory.role;
                } else {
                    creep.memory.role = this.getFallbackRole(creep);
                    role = creep.memory.role;
                    logger.info(`Assigned fallback role ${role} to creep ${name}`);
                }
            }
            try {
                let roleModule = require('role.' + role);
                roleModule.run(creep);
            } catch (error) {
                logger.error(`Error running role ${role} for creep ${name}: ${error.message}`);
            }
        }
    },

    determineRole: function(creep) {
        let body = creep.body;
        let hasWork = _.some(body, part => part.type === WORK);
        let hasCarry = _.some(body, part => part.type === CARRY);
        let hasMove = _.some(body, part => part.type === MOVE);

        if (hasCarry && hasMove && !hasWork) {
            creep.memory.role = 'hauler';
            return true;
        } else if (hasWork && hasCarry && hasMove) {
            if (_.filter(body, part => part.type === CARRY).length > _.filter(body, part => part.type === WORK).length) {
                creep.memory.role = 'hauler';
            } else {
                creep.memory.role = 'worker';
            }
            return true;
        } else if (hasWork && !hasCarry && hasMove) {
            creep.memory.role = 'harvester';
            return true;
        } else if (hasMove && !hasWork && !hasCarry) {
            creep.memory.role = 'scout';
            return true;
        } else if (hasWork && hasCarry && !hasMove) {
            creep.memory.role = 'remoteHarvester';
            return true;
        }
        return false;
    },

    getFallbackRole: function(creep) {
        return 'worker'; // Kann später dynamischer gemacht werden
    }
};