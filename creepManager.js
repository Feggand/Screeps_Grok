module.exports = {
    runCreeps: function() {
        for (let name in Game.creeps) {
            let creep = Game.creeps[name];
            let role = creep.memory.role;
            if (!role || typeof role !== 'string' || role === 'undefined') {
                console.log(`Invalid or undefined role for creep ${name}, setting to 'worker' as fallback`);
                creep.memory.role = 'worker'; // Fallback für fehlerhafte Rollen
                role = 'worker';
            }
            try {
                let roleModule = require('role.' + role);
                roleModule.run(creep);
            } catch (error) {
                console.log(`Error running role ${role} for creep ${name}: ${error.message}`);
            }
        }
    }
};