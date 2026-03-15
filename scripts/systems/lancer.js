import { BaseSystem } from "./base-system.js";

export class Lancer extends BaseSystem {

    static INDEX_FIELDS = [
        "system.stats",
        "system.derived",
        "system.mechType",
        "type"
    ];

    // Lancer typically uses "mech", "pilot", "npc"
    static ACTOR_TYPES = ["mech", "pilot", "npc", "vehicle", "ship", "deployable"];

    static HEADER_CONFIG = {
        type: {
            class: "actor-cell-lancer-type",
            label: "Type",
            sort: 'data-sort-id="type"',
        },
        hull: {
            class: "actor-cell-lancer-stat",
            label: "Hull",
            sort: 'data-sort-id="hull"',
        },
        agi: {
            class: "actor-cell-lancer-stat",
            label: "Agi",
            sort: 'data-sort-id="agi"',
        },
        sys: {
            class: "actor-cell-lancer-stat",
            label: "Sys",
            sort: 'data-sort-id="sys"',
        },
        eng: {
            class: "actor-cell-lancer-stat",
            label: "Eng",
            sort: 'data-sort-id="eng"',
        },
        structure: {
            class: "actor-cell-lancer-stat",
            label: "Struct",
            sort: 'data-sort-id="structure"',
        },
        hp: {
            class: "actor-cell-lancer-stat",
            label: "HP",
            sort: 'data-sort-id="hp"',
        },
        armor: {
            class: "actor-cell-lancer-stat",
            label: "Arm",
            sort: 'data-sort-id="armor"',
        },
        reactor: {
            class: "actor-cell-lancer-stat",
            label: "React",
            sort: 'data-sort-id="reactor"',
        },
        heat: {
            class: "actor-cell-lancer-stat",
            label: "Heat",
            sort: 'data-sort-id="heat"',
        },
        speed: {
            class: "actor-cell-lancer-stat",
            label: "Spd",
            sort: 'data-sort-id="speed"',
        },
        save: {
            class: "actor-cell-lancer-stat",
            label: "Sv",
            sort: 'data-sort-id="save"',
        },
        evade: {
            class: "actor-cell-lancer-stat",
            label: "Ev",
            sort: 'data-sort-id="evade"',
        },
        edef: {
            class: "actor-cell-lancer-stat",
            label: "EDef",
            sort: 'data-sort-id="edef"',
        },
        sensor: {
            class: "actor-cell-lancer-stat",
            label: "Sens",
            sort: 'data-sort-id="sensor"',
        },
        spacer: {
            class: "actor-cell-lancer-spacer",
            label: "",
            sort: "",
        }
    };

    async buildRowData(actors, headerData) {
        let rowData = [];

        const NA = { display: "-", sortValue: Number.MAX_SAFE_INTEGER };
        const hasMechStats = (actor) => ["mech", "npc"].includes(actor.type);

        for (const actor of actors) {
            const mechStats = hasMechStats(actor);

            let data = {
                ...this.buildCommonRowData(actor),
                type: { display: actor.type.toUpperCase(), sortValue: actor.type },

                hull: mechStats ? this.getValue(actor, "system.hull") : NA,
                agi: mechStats ? this.getValue(actor, "system.agi") : NA,
                sys: mechStats ? this.getValue(actor, "system.sys") : NA,
                eng: mechStats ? this.getValue(actor, "system.eng") : NA,

                structure: mechStats ? this.getValue(actor, "system.structure.value") : NA,

                hp: {
                    display: actor.system.hp?.max || 0,
                    sortValue: actor.system.hp?.max || 0
                },

                armor: this.getValue(actor, "system.armor"),

                reactor: mechStats ? this.getValue(actor, "system.stress.value") : NA,

                heat: mechStats ? {
                    display: actor.system.heat?.max || 0,
                    sortValue: actor.system.heat?.max || 0
                } : NA,

                speed: this.getValue(actor, "system.speed"),
                save: mechStats ? this.getValue(actor, "system.save") : NA,
                evade: this.getValue(actor, "system.evasion"),
                edef: this.getValue(actor, "system.e_defense"),
                sensor: mechStats ? this.getValue(actor, "system.sensors") : NA,
                spacer: { display: "", sortValue: "" }
            };

            if (actor.system.edef !== undefined && data.edef.display === 0) {
                data.edef = { display: actor.system.edef, sortValue: actor.system.edef };
            }

            rowData.push(data);
        }

        this.buildRowHtml(rowData, headerData);

        return rowData;
    }

    // Helper to get simple stat objects {display, sortValue}
    getStat(actor, statName) {
        // Lancer stats are often system[statName] directly or system.stats[statName]
        // Adjusting based on common Lancer data models: system[statName] (e.g. system.hull)
        const val = actor.system[statName] ?? 0;
        return { display: val, sortValue: val };
    }

    // Helper to extract value safely and return {display, sortValue}
    getValue(actor, path) {
        const val = foundry.utils.getProperty(actor, path) ?? 0;
        if (typeof val === "object") {
            // Fallback if it picks up an object
            return { display: "-", sortValue: 0 };
        }
        return { display: val, sortValue: val };
    }
}
