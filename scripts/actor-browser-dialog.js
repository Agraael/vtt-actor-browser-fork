import { DEFAULT_CONFIG, SETTING_KEYS } from "./module-config.js";
import { Utils } from "./utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActorBrowserDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "actor-browser-dialog",
        tag: "div",
        classes: ["actor-browser-dialog"],
        window: { title: "ACTOR_BROWSER.ActorBrowser" },
        position: { width: 1300, height: 600 },
        actions: {
            select: function (event, button) { this.select(); },
            close: function (event, button) { this.close(); }
        },
    };

    static PARTS = {
        body: {
            template: DEFAULT_CONFIG.templates.actorBrowserDialogBody,
        },
        footer: {
            template: DEFAULT_CONFIG.templates.actorBrowserDialogFooter,
        }
    };

    static ALL_ID = "all";
    static WORLD_ACTORS_ID = "worldActors";
    static ALL_FOLDERS_ID = "allFolders";
    static NO_FOLDER_ID = "noFolder";



    constructor(options = {}) {
        if (options.validFilterSources && !Array.isArray(options.validFilterSources)) {
            Utils.showNotification("error", "validFilterSources was not an array");
            delete options.validFilterSources;
        }

        super(options);


        // View modes
        this.lastState = Utils.getSetting(SETTING_KEYS.persistState) ? (game.user.getFlag("actor-browser", "lastState") || {}) : {};

        this.viewMode = this.lastState.viewMode || Utils.getSetting(SETTING_KEYS.defaultViewMode) || "table"; // "table" or "grid"
        this.expandedFolders = new Set(this.lastState.expandedFolders || []); // Track expanded folders
        this.recursiveFilter = this.lastState.recursiveFilter ?? false; // By default, don't include subfolders

        this.sourceFilter = this.lastState.sourceFilter || null;
        this.folderFilter = this.lastState.folderFilter || null;
        this.searchName = this.lastState.searchName || "";
        this.sortColumn = this.lastState.sortColumn || "name";
        this.sortOrder = this.lastState.sortOrder || 1;

        this.dragDrop = new DragDrop({
            dragSelector: '.actor-option',
            callbacks: {
                dragstart: this.onDragStart.bind(this),
            }
        });

        this.systemHandler = game.actorBrowser.systemHandler;
        this.systemHandler.clearFilters(this);
        this.systemHandler.clearSearches(this);
    }

    onDragStart(event) {
        if ('link' in event.target.dataset) return;

        let dragData = {
            type: "Actor",
            uuid: event.currentTarget.dataset.actorId,
        };

        event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    }

    async _prepareContext(_options) {
        let actors = [];
        let sources = [];

        if (this.options.worldActorsOnly) {
            this.sourceFilter = ActorBrowserDialog.WORLD_ACTORS_ID;
            sources.push({ id: ActorBrowserDialog.WORLD_ACTORS_ID, label: game.i18n.localize("ACTOR_BROWSER.Source.WorldActors") });
        } else {
            //Add an "all" default and the world actors to the sources list
            sources.push({ id: ActorBrowserDialog.ALL_ID, label: game.i18n.localize("ACTOR_BROWSER.Source.AllActors") });
            sources.push({ id: ActorBrowserDialog.WORLD_ACTORS_ID, label: game.i18n.localize("ACTOR_BROWSER.Source.WorldActors") });
        }

        //Grab the actors that are local to this world
        actors = actors.concat(...this.getWorldActors());

        if (!this.options.worldActorsOnly) {
            //Grab all actors from compendiums
            let packActors = await this.getPackActors();
            sources = sources.concat(...packActors.sources);
            actors = actors.concat(...packActors.actors);
        }

        if (this.options.validFilterSources) {
            //We have been provided a list of valid sources. Filter out what doesn't match
            let filteredSources = sources.filter((s) => this.options.validFilterSources.find((f) => f == s.id));
            if (filteredSources.length) {
                //We will only use the filtered sources if there is at least one valid source
                sources = filteredSources;
            }
        }

        if (!this.sourceFilter) {
            if (this.options.initialSourceFilter) {
                this.sourceFilter = sources.find((s) => s.id == this.options.initialSourceFilter) ? this.options.initialSourceFilter : sources[0].id;
            } else {
                const defaultSource = Utils.getSetting(SETTING_KEYS.defaultSource);
                this.sourceFilter = (defaultSource && sources.find(s => s.id == defaultSource)) ? defaultSource : sources[0].id;
            }
        }

        // Get folder tree for world actors or compendiums
        let folderTree = null;
        let showFolderFilter = false;
        if (this.sourceFilter != ActorBrowserDialog.ALL_ID) {
            folderTree = this.getFolderTree(this.sourceFilter, actors);
            showFolderFilter = folderTree.children.length > 0;

            if (!this.folderFilter) {
                this.folderFilter = ActorBrowserDialog.ALL_FOLDERS_ID;
            }
        } else {
            this.folderFilter = ActorBrowserDialog.ALL_FOLDERS_ID;
        }

        let additionalFiltersData = this.systemHandler.getAdditionalFiltersData(this, actors);
        let additionalSearchesData = this.systemHandler.getAdditionalSearchesData(this, actors);

        const headerData = this.getHeaderData();

        this.searchName = this.searchName ?? "";
        this.sortColumn = this.sortColumn ?? "name";
        this.sortOrder = this.sortOrder ?? 1;

        // Mark active folder in tree
        if (folderTree) {
            this._markActiveFolder(folderTree, this.folderFilter);
        }

        let filteredActors = this.filterActors(actors);
        this.rowData = await this.systemHandler.buildRowData(filteredActors, headerData);
        this.rowData = this.filterRows(this.rowData);
        this.rowData = this.sortRows(this.rowData, this.sortColumn, this.sortOrder);

        let selectButtonString = this.getSelectButtonString();

        return {
            sources: sources,
            sourceFilter: this.sourceFilter,
            folderTree: folderTree,
            folderFilter: this.folderFilter,
            showFolderFilter: showFolderFilter,
            searchName: this.searchName,
            actors: this.rowData,
            selectedActor: this.selectedActor,
            selectButtonString: selectButtonString,
            additionalFiltersData: additionalFiltersData,
            additionalSearchesData: additionalSearchesData,
            headerData: headerData,
            headerData: headerData,
            recursiveFilter: this.recursiveFilter,
            viewModeClass: this.viewMode === "grid" ? "grid-view" : "table-view",
            viewModeIcon: this.viewMode === "grid" ? "fas fa-table" : "fas fa-th"
        };
    };

    _markActiveFolder(node, activeId) {
        if (!node) return;
        if (node.id === activeId) {
            node.isActive = true;
        }
        if (node.children) {
            node.children.forEach(child => this._markActiveFolder(child, activeId));
        }
    }

    /**
    * Actions performed after any render of the Application.
    * Post-render steps are not awaited by the render process.
    * @param {ApplicationRenderContext} context      Prepared context data
    * @param {RenderOptions} options                 Provided render options
    * @protected
    */
    _onRender(context, options) {
        this.activateListeners();

        // Restore view mode class
        const listContainer = this.element.querySelector(".actor-list-container");
        const toggleButton = this.element.querySelector('.view-toggle-button');
        if (listContainer && toggleButton) {
            const toggleIcon = toggleButton.querySelector('i');
            listContainer.classList.remove("table-view", "grid-view");

            if (this.viewMode === "grid") {
                listContainer.classList.add("grid-view");
                toggleIcon.className = "fas fa-table"; // Show table icon when in grid view
            } else {
                listContainer.classList.add("table-view");
                toggleIcon.className = "fas fa-th"; // Show grid icon when in table view
            }
        }

        // Apply grid size
        const gridSize = Utils.getSetting(SETTING_KEYS.gridSize) || 150;
        const gridContainer = this.element.querySelector(".actor-grid-container");
        if (gridContainer) {
            gridContainer.style.setProperty("--actor-grid-size", `${gridSize}px`);
        }
    }

    async renderActorList(data) {
        //Re-render both the table and grid views with the newly filtered list
        const listContent = await renderTemplate(DEFAULT_CONFIG.templates.actorList, data);
        const gridContent = await renderTemplate(DEFAULT_CONFIG.templates.actorGrid, data);

        let listPanel = this.element.querySelector(".list-panel");
        let actorList = listPanel.querySelector(".actor-list");
        let actorGrid = listPanel.querySelector(".actor-grid-container");

        actorList.innerHTML = listContent;
        actorGrid.innerHTML = gridContent;

        //We need to activate listeners again since we just stomped over the existing html
        this.activateTableListeners(this.element);
        this.activateGridListeners(this.element);
    }

    activateListeners() {
        //Add a keyup listener on the searchName input so that we can filter as we type
        const searchNameSelector = this.element.querySelector('input.search-name');
        searchNameSelector.addEventListener("keyup", async event => {
            this.searchName = event.target.value;
            this._saveState();
            let data = await this._prepareContext();
            await this.renderActorList(data);
        });

        //Add the listener to the source dropdown
        const filterSelector = this.element.querySelector('select[id="source-filter"]');
        filterSelector.addEventListener("change", async event => {
            const selection = $(event.target).find("option:selected");
            this.sourceFilter = selection.val();
            this._saveState();
            // Need to re-render the whole dialog to show/hide the folder filter
            await this.render(true);
        });

        //Add the listener to the recursive filter checkbox
        const recursiveCheckbox = this.element.querySelector('#recursive-filter');
        if (recursiveCheckbox) {
            recursiveCheckbox.addEventListener("change", async event => {
                this.recursiveFilter = event.target.checked;
                this._saveState();
                let data = await this._prepareContext();
                await this.renderActorList(data);
            });
        }

        //Add the listener to the folder tree items
        const folderItems = this.element.querySelectorAll('.folder-tree-item-wrapper');
        for (let item of folderItems) {
            // Click on toggle button
            const toggle = item.querySelector('.folder-tree-toggle');
            if (toggle) {
                toggle.addEventListener("click", async event => {
                    $("#context-menu").remove();
                    const folderId = toggle.dataset.folderId;
                    if (this.expandedFolders.has(folderId)) {
                        this.expandedFolders.delete(folderId);
                    } else {
                        this.expandedFolders.add(folderId);
                    }
                    this._saveState();
                    await this.render(true);
                });
            }

            // Click on item itself (filter)
            const itemDiv = item.querySelector('.folder-tree-item');
            if (itemDiv) {
                itemDiv.addEventListener("click", async event => {
                    $("#context-menu").remove();
                    const folderId = item.dataset.folderId;
                    if (this.folderFilter === folderId) {
                        return;
                    }
                    this.folderFilter = folderId;
                    this._saveState();
                    await this.render(true);
                });
            }
        }

        // Add listener for "All Folders" if present (usually tree handles root as All, or specific button)
        // Check if we have a specific clear filter button or if root 'all' node exists


        // Add the listener for the view toggle button
        const viewToggleButton = this.element.querySelector('.view-toggle-button');
        if (viewToggleButton) {
            viewToggleButton.addEventListener("click", () => {
                this.toggleView();
            });
        }

        this.activateTableListeners(this.element);
        this.activateGridListeners(this.element);
        this.systemHandler.activateListeners(this);

        // Context Menu
        const menuItems = this._getContextMenuItems();
        // Bind to the main element to ensure delegation works even if inner content is replaced
        const menu = new ContextMenu($(this.element), ".actor-option", menuItems);

        const originalRender = menu.render.bind(menu);
        menu.render = function (target) {
            $("#context-menu").remove();

            originalRender(target);

            // Find the menu
            const menuHtml = $("#context-menu");
            if (menuHtml.length && target && target.length) {
                $("body").append(menuHtml);

                const offset = target.offset();


                menuHtml.css({
                    position: "absolute",
                    top: offset.top + target.outerHeight(),
                    left: offset.left,
                    zIndex: 2147483647
                });
            }
        };
    }

    activateTableListeners(element) {
        //Grab all the table header cells and add clicks to them so we can sort by column
        const columns = element.querySelectorAll("th");
        for (let column of columns) {
            let columnName = column.dataset.sortId;
            if (columnName) {
                column.addEventListener("click", async event => {
                    if (this.sortColumn == columnName) {
                        //We're clicking the same column so reverse the sort order
                        this.sortOrder *= -1;
                    }
                    else {
                        //This is a different column that we had sorted before so set our sort to 1
                        this.sortOrder = 1;
                    }
                    this.sortColumn = columnName;
                    this._saveState();
                    let data = await this._prepareContext();
                    await this.renderActorList(data);
                });
            }
        }

        //Add click listeners to the table rows so we can select them
        const rows = element.querySelectorAll("tr");
        for (let row of rows) {
            if (row.rowIndex == 0) continue; //Skip the header row

            row.addEventListener("click", async event => {
                this.selectedActor = row.dataset.actorId;

                //Loop over the rows and add/remove the selected class as needed
                for (let r of rows) {
                    if (!r.dataset?.actorId) continue;
                    if (r.dataset.actorId == this.selectedActor) {
                        if (!r.classList.contains("selected")) {
                            r.classList.add("selected");
                        }
                    } else {
                        r.classList.remove("selected");
                    }
                }

                //Update the select button
                const selectButton = element.querySelector('[data-action="select"]');
                let selectButtonString = this.getSelectButtonString();
                selectButton.textContent = selectButtonString;
                selectButton.disabled = false;
            });

            row.addEventListener("dblclick", async event => {
                this.select();
            });
        }

        this.dragDrop.bind(this.element);
    }

    activateGridListeners(element) {
        // Add click listeners to grid items
        const gridItems = element.querySelectorAll(".actor-grid-item");
        for (let item of gridItems) {
            item.addEventListener("click", async () => {
                this.selectedActor = item.dataset.actorId;

                // Loop over items and add/remove the selected class
                for (let i of gridItems) {
                    if (i.dataset.actorId == this.selectedActor) {
                        if (!i.classList.contains("selected")) {
                            i.classList.add("selected");
                        }
                    } else {
                        i.classList.remove("selected");
                    }
                }

                // Update the select button
                const selectButton = element.querySelector('[data-action="select"]');
                let selectButtonString = this.getSelectButtonString();
                selectButton.textContent = selectButtonString;
                selectButton.disabled = false;
            });

            item.addEventListener("dblclick", async () => {
                this.select();
            });
        }
    }

    toggleView() {
        // Toggle between table and grid view
        this.viewMode = this.viewMode === "table" ? "grid" : "table";
        this._saveState();
        this.render(true);
    }

    async getPackActors() {
        let actors = [];
        let sources = [];
        for (const pack of game.packs) {
            if (pack.documentName != "Actor") continue;
            if (!pack.testUserPermission(game.user, "OBSERVER")) continue;

            // Get index with folder field included for folder filtering
            let indexFields = [...this.systemHandler.constructor.INDEX_FIELDS];
            if (!indexFields.includes("folder")) {
                indexFields.push("folder");
            }
            let packIndex = await pack.getIndex({ fields: indexFields });
            if (packIndex.size == 0) continue;

            packIndex = this.filterActorsByType(packIndex);
            if (packIndex.length == 0) continue;

            actors = actors.concat(...packIndex);
            let label = pack.title;
            if (pack.metadata.packageType == "world") {
                label += " (" + game.i18n.localize("ACTOR_BROWSER.WorldCompendium") + ")";
            } else {
                label += " (" + pack.metadata.packageName + ")";
            }
            sources.push({ id: pack.metadata.id, label: label });
        }

        return { actors, sources };
    }

    getWorldActors() {
        let actors = [];
        for (const actor of game.actors) {
            if (!actor.testUserPermission(game.user, "OBSERVER")) continue;
            actors.push(actor);
        }

        actors = this.filterActorsByType(actors);
        return actors;
    }

    getFolderTree(sourceFilter, actors) {
        let rootNode = {
            id: ActorBrowserDialog.ALL_FOLDERS_ID,
            name: game.i18n.localize("ACTOR_BROWSER.Folder.AllFolders"),
            children: [],
            isRoot: true,
            indent: 0,
            count: actors.length
        };

        let actorFolders = [];
        let folderMap = new Map();

        // Collect folders based on source
        if (sourceFilter === ActorBrowserDialog.WORLD_ACTORS_ID) {
            for (const actor of actors) {
                if (actor.folder) {
                    let folderObj = actor.folder;
                    if (typeof actor.folder === 'string') {
                        folderObj = game.folders.get(actor.folder);
                    }

                    // Walk up parents and add all to map
                    let current = folderObj;
                    while (current) {
                        if (!folderMap.has(current.id)) {
                            folderMap.set(current.id, current);
                        }
                        current = current.folder;
                    }
                }
            }
            actorFolders = Array.from(folderMap.values());
        } else {
            const pack = game.packs.get(sourceFilter);
            if (pack && pack.folders) {
                actorFolders = Array.from(pack.folders.contents || pack.folders);
                // Map them for easier lookup by ID
                actorFolders.forEach(f => folderMap.set(f._id || f.id, f));
            }
        }

        // Helper to count actors in a folder (recursive)
        // For Compendium folders, 'contents' might not be populated same as World folders. 
        // We iterate 'actors' and check matches.
        const countActorsInFolder = (folderId) => {
            // Simple version: iterate all filtered actors and check
            // Optimized: pre-process actors? 
            // Let's iterate, 1000 actors * 50 folders is 50k ops, fine.
            let count = 0;
            for (const actor of actors) {
                if (!actor.folder) continue;

                // Logic from filterActors to check ancestry
                // We need to check if actor.folder (or its parents) == folderId
                // But here we want direct or recursive count? 
                // Usually UI shows count of items inside relevant to the filter.
                // Let's assume hierarchy count (folder + subfolders).

                let currentFolderId;
                let currentFolderObj;
                if (typeof actor.folder === 'string') {
                    currentFolderId = actor.folder;
                    currentFolderObj = folderMap.get(currentFolderId); // Optimistic lookup from our gathered set
                    if (!currentFolderObj && sourceFilter === ActorBrowserDialog.WORLD_ACTORS_ID) currentFolderObj = game.folders.get(currentFolderId);
                } else {
                    currentFolderId = actor.folder.id;
                    currentFolderObj = actor.folder;
                }

                // Traverse up
                while (currentFolderObj) {
                    if (currentFolderObj.id === folderId) {
                        count++;
                        break;
                    }
                    // Get parent
                    let parentId = currentFolderObj.folder?.id || currentFolderObj.folder; // Handle object or ID
                    if (!parentId) break;

                    currentFolderObj = folderMap.get(parentId);
                    // Fallback for world
                    if (!currentFolderObj && sourceFilter === ActorBrowserDialog.WORLD_ACTORS_ID && typeof parentId === 'string') {
                        currentFolderObj = game.folders.get(parentId);
                    }
                }
            }
            return count;
        }


        // Build Tree structure
        // 1. Find root folders (those with no parent in the *filtered set* or global root)
        // Note: compendium folders might have parents that exist in the pack.

        let allNodes = new Map();

        // Create nodes for all relevant folders
        for (const folder of actorFolders) {
            allNodes.set(folder.id, {
                id: folder.id,
                name: folder.name,
                children: [],
                indent: 0,
                parent: folder.folder?.id || folder.folder, // ID or object
                count: 0,
                isExpanded: this.expandedFolders.has(folder.id),
                color: folder.color || folder.folder?.color // Compendium folders might be nested differently, but usually 'color' is top level
            });
        }

        // Calculate counts (this bit is expensive O(N*M), maybe optimize later if needed)
        // For now, let's just do it
        for (const [id, node] of allNodes) {
            node.count = countActorsInFolder(id);
        }

        // Assemble hierarchy
        let topLevelNodes = [];

        for (const [id, node] of allNodes) {
            if (node.parent && allNodes.has(node.parent)) {
                let parentNode = allNodes.get(node.parent);
                parentNode.children.push(node);
            } else {
                topLevelNodes.push(node);
            }
        }

        // Sort by name
        const sortNodes = (nodes) => {
            nodes.sort((a, b) => a.name.localeCompare(b.name));
            nodes.forEach(n => {
                if (n.children.length) sortNodes(n.children);
            });
        };
        sortNodes(topLevelNodes);

        // Root node directly contains top-level folders
        rootNode.children.push(...topLevelNodes);

        // Indentation calculation (recursive)
        const setIndent = (nodes, level) => {
            for (const node of nodes) {
                node.indent = level * 10;
                setIndent(node.children, level + 1);
            }
        };
        setIndent(rootNode.children, 0);

        return rootNode;
    }

    async _saveState() {
        if (!Utils.getSetting(SETTING_KEYS.persistState)) return;
        const state = {
            viewMode: this.viewMode,
            expandedFolders: Array.from(this.expandedFolders),
            recursiveFilter: this.recursiveFilter,
            sourceFilter: this.sourceFilter,
            folderFilter: this.folderFilter,
            searchName: this.searchName,
            sortColumn: this.sortColumn,
            sortOrder: this.sortOrder
        };
        await game.user.setFlag("actor-browser", "lastState", state);
    }

    _getContextMenuItems() {
        // Get standard Actor Directory context menu items
        let menuItems = ui.actors._getEntryContextOptions();

        // Allow other modules to extend this menu
        // We use the standard hook to allow things like "Add to Stage" to work if they hook this specific event
        Hooks.call("getActorDirectoryEntryContext", this.element, menuItems);

        // Also fire a specific one for this browser
        Hooks.call("getActorBrowserContext", this.element, menuItems);

        // Wrap ALL items to strictly require a valid World Actor
        menuItems = menuItems.map(item => {
            const newItem = { ...item };
            const originalCondition = newItem.condition;
            newItem.condition = li => {
                // Use raw DOM dataset for reliability
                const element = li[0];
                if (!element) return false;

                const uuid = element.dataset.actorId;
                const docId = element.dataset.documentId;

                // 2. Check for World Actor existence using documentId
                if (!docId) return false;

                if (uuid && uuid.startsWith("Compendium")) return false;


                li.addClass("document actor directory-item");

                const actor = game.actors.get(docId);
                if (!actor) return false;

                if (!originalCondition) return true;

                try {
                    return originalCondition.call(ui.actors, li);
                } catch (err) {
                    return false;
                }
            };
            return newItem;
        });

        // Add "Import" for Compendium actors
        menuItems.push({
            name: "ACTOR.Import",
            icon: '<i class="fas fa-download"></i>',
            condition: li => {
                const element = li[0];
                const uuid = element?.dataset.actorId;
                return uuid && uuid.startsWith("Compendium");
            },
            callback: li => {
                const element = li[0];
                const uuid = element?.dataset.actorId;
                if (!uuid) return;

                const parts = uuid.split(".");
                // Format: Compendium.collection.packName.Actor.ID
                const packName = parts[1] + "." + parts[2];
                const actorId = parts[4];
                const pack = game.packs.get(packName);
                if (pack) {
                    game.actors.importFromCompendium(pack, actorId);
                }
            }
        });

        return menuItems;
    }

    getHeaderData() {
        const headerConfig = this.systemHandler.constructor.HEADER_CONFIG;
        let headerData = {};
        for (let column of Object.keys(headerConfig)) {
            headerData[column] = headerConfig[column];
        }
        return headerData;
    }

    filterActorsByType(actors) {
        let filtered = actors;

        //Remove invalid actor types
        const actorTypes = this.systemHandler.constructor.ACTOR_TYPES;
        if (actorTypes.length) {
            filtered = filtered.filter((a) => actorTypes.includes(a.type));
        }

        //If the dialog has limited the available types, remove them here
        if (this.options.actorTypes?.length) {
            filtered = filtered.filter((a) => this.options.actorTypes.includes(a.type));
        }

        return filtered;
    }

    filterActors(actors) {
        let filtered = actors;

        //Filter by source
        if (this.sourceFilter != ActorBrowserDialog.ALL_ID) {
            if (this.sourceFilter == ActorBrowserDialog.WORLD_ACTORS_ID) {
                //Actors from a compendium index will not have a documentName so we can assume that actors that do must be world actors
                filtered = filtered.filter((a) => a.documentName == "Actor");
            } else {
                filtered = filtered.filter((a) => a.uuid.includes(this.sourceFilter));
            }
        }

        //Filter by folder (for world actors and compendium actors)
        if (this.folderFilter && this.folderFilter != ActorBrowserDialog.ALL_FOLDERS_ID) {
            // Determine if we're filtering world actors or compendium actors
            const isWorldActors = this.sourceFilter === ActorBrowserDialog.WORLD_ACTORS_ID;
            const pack = isWorldActors ? null : game.packs.get(this.sourceFilter);

            filtered = filtered.filter((a) => {
                if (!a.folder) return false;

                let currentFolder = a.folder;

                // For world actors, handle folder object or ID
                if (isWorldActors) {
                    if (typeof currentFolder === 'string') {
                        currentFolder = game.folders.get(currentFolder);
                    }

                    if (!currentFolder) return false;

                    // Direct match
                    if (currentFolder.id === this.folderFilter) {
                        return true;
                    }

                    // Recursive match (check ancestors) only if recursiveFilter is enabled
                    if (this.recursiveFilter) {
                        while (currentFolder.folder) {
                            currentFolder = currentFolder.folder;
                            if (currentFolder.id === this.folderFilter) {
                                return true;
                            }
                        }
                    }
                    return false;
                } else {
                    // For compendium actors, folder is an ID string
                    if (!pack || !pack.folders) return false;

                    let folderId = typeof a.folder === 'string' ? a.folder : a.folder.id;
                    if (!folderId) return false;

                    currentFolder = pack.folders.get(folderId);
                    if (!currentFolder) return false;

                    // Direct match
                    if (currentFolder.id === this.folderFilter) {
                        return true;
                    }

                    // Recursive match only if recursiveFilter is enabled
                    if (this.recursiveFilter) {
                        while (currentFolder.folder) {
                            currentFolder = pack.folders.get(currentFolder.folder);
                            if (!currentFolder) return false;
                            if (currentFolder.id === this.folderFilter) {
                                return true;
                            }
                        }
                    }
                    return false;
                }
            });
        }

        //Filter transient actors
        if (game.tcal) {
            //The TCAL module is active so filter out any transient actors so they don't clutter up the list
            filtered = filtered.filter((a) => !game.tcal.isTransientActor(a));
        }

        //System specific filter
        filtered = this.systemHandler.filterActors(filtered);

        return filtered;
    }

    filterRows(rowData) {
        let filtered = rowData;

        //Filter by the search string
        if (this.searchName) {
            filtered = filtered.filter((r) => r.name.display.toLowerCase().includes(this.searchName.toLowerCase()));
        }

        //If our selected actor does not exist in our filtered list, deselect it
        if (!filtered.find((r) => r.uuid == this.selectedActor)) {
            this.selectedActor = "";
        }

        return filtered;
    }

    sortRows(rows, sortColumn, sortOrder) {
        let retVal = rows.sort(function (a, b) {
            const sortA = a[sortColumn];
            const sortB = b[sortColumn];
            if (sortA.display == sortB.display) return 0;

            if (sortA.sortValue == Number.MAX_SAFE_INTEGER || sortB.sortValue == Number.MAX_SAFE_INTEGER) {
                //If these are both max int it means they're both "invalid" values but they may be different
                //In this case, do a string compare of their display value as a tie breaker but always treat "-" as higher so it gets pushed to the bottom of the list
                if (sortA.display == "-") return sortOrder;
                if (sortB.display == "-") return -1 * sortOrder;
                return sortA.display.localeCompare(sortB.display) * sortOrder;
            }

            if (typeof sortA.sortValue == "string" && typeof sortB.sortValue == "string") {
                return sortA.sortValue.localeCompare(sortB.sortValue) * sortOrder;
            } else {
                return (sortA.sortValue - sortB.sortValue) * sortOrder;
            }
        });

        return retVal;
    }

    getSelectButtonString() {
        let selectButtonString = game.i18n.localize(this.options.selector ? "ACTOR_BROWSER.Select" : "ACTOR_BROWSER.Open");
        if (this.selectedActor) {
            let actor = this.rowData.find((a) => a.uuid == this.selectedActor);
            selectButtonString += " " + actor.name.display;
        }
        return selectButtonString;
    }

    /**
     * Renders the dialog and awaits until the dialog is submitted or closed
     */
    async wait() {
        return new Promise((resolve, reject) => {
            // Wrap submission handler with Promise resolution.
            this.select = async result => {
                resolve(this.selectedActor);
                this.close();
            };

            this.addEventListener("close", event => {
                resolve(false);
            }, { once: true });

            this.render({ force: true });
        });
    }

    async select() {
        if (this.options.selector) {
            Utils.showNotification("error", game.i18n.localize("ACTOR_BROWSER.WaitError"));
            this.close();
            return;
        }

        //If we're not a selector, we want to open the actor sheet
        let actor = await fromUuid(this.selectedActor);
        actor.sheet.render(true);
    }
}