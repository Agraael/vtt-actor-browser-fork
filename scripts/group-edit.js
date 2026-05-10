export async function openGroupTokenEdit(actorUuids) {
    const resolved = await Promise.all(actorUuids.map(u => fromUuid(u)));
    const actors = resolved.filter(a => a instanceof Actor && a.canUserModify(game.user, "update"));
    if (!actors.length) {
        ui.notifications.warn(game.i18n.localize("ACTOR_BROWSER.GroupEditEmpty"));
        return;
    }

    const reference = actors[0];
    const proto = reference.prototypeToken;
    const original = foundry.utils.flattenObject(proto.toObject());

    const allFlat = actors.map(a => foundry.utils.flattenObject(a.prototypeToken.toObject()));
    const differingFields = computeDifferingFields(allFlat);

    const SheetCls = CONFIG.Token.prototypeSheetClass ?? proto.sheet?.constructor;
    if (!SheetCls) {
        ui.notifications.error("Could not resolve TokenConfig class");
        return;
    }
    const sheet = new SheetCls(proto, { editable: true });

    const newTitle = game.i18n.format("ACTOR_BROWSER.GroupEditTitle", { n: actors.length });
    Object.defineProperty(sheet, "title", {
        configurable: true,
        get() { return newTitle; }
    });

    sheet._updateObject = async function (event, formData) {
        const submitted = foundry.utils.flattenObject(formData);
        const diff = {};
        for (const [k, v] of Object.entries(submitted)) {
            if (!foundry.utils.objectsEqual(original[k], v)) diff[k] = v;
        }
        if (!Object.keys(diff).length) return;

        const expanded = foundry.utils.expandObject(diff);
        await Actor.updateDocuments(actors.map(a => ({
            _id: a.id,
            prototypeToken: expanded
        })));
        ui.notifications.info(game.i18n.format("ACTOR_BROWSER.GroupEditDone", { n: actors.length }));
    };

    const hookName = `render${sheet.constructor.name}`;
    const closeHookName = `close${sheet.constructor.name}`;
    const renderHookId = Hooks.on(hookName, (app, html) => {
        if (app !== sheet) return;
        markDifferingFields(html, differingFields);
    });
    const closeHookId = Hooks.on(closeHookName, (app) => {
        if (app !== sheet) return;
        Hooks.off(hookName, renderHookId);
        Hooks.off(closeHookName, closeHookId);
    });

    sheet.render(true);
}

function computeDifferingFields(allFlat) {
    const allKeys = new Set();
    for (const flat of allFlat) {
        for (const k of Object.keys(flat)) allKeys.add(k);
    }
    const differing = new Set();
    for (const k of allKeys) {
        const ref = allFlat[0][k];
        for (let i = 1; i < allFlat.length; i++) {
            if (!foundry.utils.objectsEqual(allFlat[i][k], ref)) {
                differing.add(k);
                break;
            }
        }
    }
    return differing;
}

function markDifferingFields(html, fields) {
    if (!fields.size) return;
    const root = html instanceof jQuery ? html[0] : html;
    if (!root) return;

    const tooltip = game.i18n.localize("ACTOR_BROWSER.GroupEditMixed");
    for (const field of fields) {
        const inputs = root.querySelectorAll(`[name="${CSS.escape(field)}"]`);
        for (const input of inputs) {
            input.classList.add("group-edit-mixed");
            input.dataset.tooltip = tooltip;
            if (input.type === "checkbox") input.indeterminate = true;
        }
    }
}
