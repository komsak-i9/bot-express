"use strict";

const debug = require("debug")("bot-express:memory");
const default_store = "memory-cache";
const fs = require("fs");
const memory_cache = require("memory-cache"); // Not as memory store but as timer.
const prefix_context = "botex_context_";
const prefix_timer = "botex_timer_";

/**
 * Memory to store context. *Context free
 * @class
 */
class Memory {
    /**
     * @constructor
     * @param {Object} options
     * @param {String} options.type - Store type. Supported stores are located in memory directory.
     * @param {Number} options.retention - Lifetime of the context in seconds.
     * @param {Object} options.options - Options depending on the memory store.
     * @param {Object} logger
     */
    constructor(options, logger){
        this.logger = logger;
        this.retention = options.retention || 600;

        if (!options.type) options.type = default_store;

        let store_scripts = fs.readdirSync(__dirname + "/memory");
        for (let store_script of store_scripts){
            if (store_script.replace(".js", "") == options.type){
                debug(`Found plugin for specified memory store. Loading ${options.type}..`);
                let Store = require("./memory/" + options.type);
                this.store = new Store(options.options);
            }
        }

        if (!this.store){
            throw new Error(`Specified store type "${options.type}" is not supported for Memory.`);
        }
    }

    /**
    Get the context by key.
    @function
    @param {String} key - Key of the context.
    @returns {Promise.<context>} context - Context object.
    */
    async get(key){
        return this.store.get(`${prefix_context}${key}`);
    }

    /**
    Put the context by key.
    @function
    @param {String} key - Key of the context.
    @param {context} context - Context object to store.
    @param {*} bot - bot instance.
    @param {Number} retention - Lifetime of the context in seconds.
    @returns {Promise.<null>}
    */
    async put(key, context, bot, retention = this.retention){
        context.updated_at = new Date().getTime();

        // Set timer.
        memory_cache.put(`${prefix_timer}${key}`, { 
            updated_at: context.updated_at, 
            key: key,
            bot: bot
        }, retention * 1000, async (timer_key, timer_value) => {
            debug("Context timer launching.");

            const context = await this.get(timer_value.key);

            // Check if the context is updated by other nodes. If updated, we do nothing.
            if (context && context.updated_at === timer_value.updated_at){
                debug("Confirmed this context is own by this node. Running expiration process..");

                // Delete context.
                debug("Deleting context..");
                await this.del(timer_value.key);

                // If context indicates the conversation is not finished, we log aborted and run on_abort function.
                if (context.confirming && context.skill && context.skill.type != "builtin_default"){
                    debug("It seems this conversation is aborted. Running on abort process..");

                    // Log skill-status.
                    await this.logger.skill_status(timer_value.key, context.chat_id, context.skill.type, "aborted", { context });

                    // Check if skill exists.
                    let skip_on_abort = false;
                    try {
                        require.resolve(`${context.skill.path}${context.skill.type}`);
                    } catch (e){
                        debug(`Try to find on_abort function but skill: "${context.skill.path}${context.skill.type}" not found.`)
                        skip_on_abort = true;
                    }

                    // Run on_abort function.
                    if (!skip_on_abort){
                        debug("Running on_abort function..");
                        const Skill = require(`${context.skill.path}${context.skill.type}`);
                        const skill = new Skill();
                        if (typeof skill.on_abort === "function"){
                            await skill.on_abort(timer_value.bot, context.event, context);
                        }
                    }
                }
            } else {
                debug("It seems this context is owned by another node. We do nothing here.")
            }
        })

        // Save context.
        return this.store.put(`${prefix_context}${key}`, context);
    }

    /**
    Delete the context by key.
    @function
    @param {String} key - Key of the context.
    @returns {Promise.<null>}
    */
    async del(key){
        // Delete timer.
        memory_cache.del(`${prefix_timer}${key}`);
        
        // Delete context.
        return this.store.del(`${prefix_context}${key}`);
    }

    /**
    Close the connection.
    @function
    @returns {Promise.null}
    */
    async close(){
        return this.store.close();
    }
}

module.exports = Memory;
