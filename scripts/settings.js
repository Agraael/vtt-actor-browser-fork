import * as MODULE_CONFIG from "./module-config.js";
import { Utils } from "./utils.js";

export function registerSettings() {

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.showOnActorDirectory, {
        name: "ACTOR_BROWSER.Settings.ShowOnActorDirectoryN",
        hint: "ACTOR_BROWSER.Settings.ShowOnActorDirectoryH",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
        onChange: s => {
            ui.actors.render(true);
        }
    });

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.useSmallButton, {
        name: "ACTOR_BROWSER.Settings.UseSmallButtonN",
        hint: "ACTOR_BROWSER.Settings.UseSmallButtonH",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
        onChange: s => {
            ui.actors.render(true);
        }
    });

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.defaultSource, {
        name: "ACTOR_BROWSER.Settings.DefaultSourceN",
        hint: "ACTOR_BROWSER.Settings.DefaultSourceH",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "all": "ACTOR_BROWSER.Source.AllActors",
            "worldActors": "ACTOR_BROWSER.Source.WorldActors"
        },
        default: "worldActors"
    });

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.defaultViewMode, {
        name: "ACTOR_BROWSER.Settings.DefaultViewModeN",
        hint: "ACTOR_BROWSER.Settings.DefaultViewModeH",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "table": "ACTOR_BROWSER.ViewMode.Table",
            "grid": "ACTOR_BROWSER.ViewMode.Grid"
        },
        default: "grid"
    });

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.gridSize, {
        name: "ACTOR_BROWSER.Settings.GridSizeN",
        hint: "ACTOR_BROWSER.Settings.GridSizeH",
        scope: "world",
        config: true,
        type: Number,
        range: {
            min: 100,
            max: 300,
            step: 10
        },
        default: 150
    });

    Utils.registerSetting(MODULE_CONFIG.SETTING_KEYS.persistState, {
        name: "ACTOR_BROWSER.Settings.PersistStateN",
        hint: "ACTOR_BROWSER.Settings.PersistStateH",
        scope: "client",
        config: true,
        type: Boolean,
        default: true
    });
}