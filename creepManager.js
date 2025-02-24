module.exports = {
    runCreeps: function() {
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            let role = creep.memory.role;
            if (!role || typeof role !== 'string' || role === 'undefined') {
                console.log(`Invalid or undefined role for creep ${name}, determining role from body or spawn logic`);
                // Versuche, die Rolle aus dem Körper oder der Spawn-Logik zu ermitteln
                if (this.determineRole(creep)) {
                    role = creep.memory.role;
                } else {
                    creep.memory.role = 'worker'; // Letzter Fallback
                    role = 'worker';
                }
            }
            try {
                let roleModule = require('role.' + role);
                roleModule.run(creep);
            } catch (error) {
                console.log(`Error running role ${role} for creep ${name}: ${error.message}`);
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
        return false; // Rolle konnte nicht bestimmt werden
    }
};