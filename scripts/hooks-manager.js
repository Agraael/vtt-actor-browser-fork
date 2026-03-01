import { Utils } from "./utils.js";
import { registerSettings } from "./settings.js";
import { ActorBrowser } from "./actor-browser.js";
import { ActorBrowserDialog } from "./actor-browser-dialog.js";

export class HooksManager {
    /**
     * Registers hooks
     */
    static registerHooks() {
        /* ------------------- Init/Ready ------------------- */

        Hooks.on("init", async () => {
            game.actorBrowser = game.actorBrowser ?? {};

            // Expose API
            game.actorBrowser.ActorBrowserDialog = ActorBrowserDialog;
            game.actorBrowser.openBrowser = ActorBrowser.openBrowser;

            registerSettings();

            ActorBrowser.createSystemHandler();

            Utils.loadTemplates();

            game.keybindings.register("actor-browser", "openBrowser", {
                name: "Open Actor Browser",
                editable: [{ key: "KeyA", modifiers: ["Control"] }],
                onDown: () => {
                    const existing = foundry.applications.instances.get("actor-browser-dialog");
                    if (existing) {
                        existing.close();
                    } else {
                        new ActorBrowserDialog({ selector: false }).render(true);
                    }
                    return true;
                }
            });
        });

        Hooks.on("renderActorDirectory", async (app, html, data) => {
            await ActorBrowser.onRenderActorDirectory(app, html, data);
        });
    }
} 