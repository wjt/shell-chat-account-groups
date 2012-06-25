/*
 * Copyright © 2012 Will Thompson <will@willthompson.co.uk>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */

const Lang = imports.lang;
const Main = imports.ui.main;

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Tp = imports.gi.TelepathyGLib;
const St = imports.gi.St;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;
const ExtensionSystem = imports.ui.extensionSystem;

function AccountItem() {
    this._init.apply(this, arguments);
}

AccountItem.prototype = {
    __proto__: PopupMenu.PopupMenuItem.prototype,

    _init: function(account) {
        PopupMenu.PopupMenuItem.prototype._init.call(this,
            account.get_display_name());

        this.label.add_style_class_name('popup-inactive-menu-item');
        this.actor.reactive = false;
        this.actor.can_focus = false;

        this._presenceBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._presenceBin,
                      { expand: true, span: -1, align: St.Align.END });

        this._presenceLabel = new St.Label({ text: '\u26f7',
                                             style_class: 'popup-inactive-menu-item'
                                           });
        this._presenceBin.child = this._presenceLabel;

        account.connect('presence-changed', Lang.bind(this,
            this._onPresenceChanged));
        let [presence, status, message] = account.get_current_presence();
        this._onPresenceChanged(account, presence, status, message);
    },

    _onPresenceChanged: function(account, presence, status, message) {
        this._presenceLabel.text = status;
    },
};

function AccountGroupSection() {
    this._init.apply(this, arguments);
}

AccountGroupSection.prototype = {
    __proto__: PopupMenu.PopupMenuSection.prototype,

    _init: function(am, groupName, accountIDs) {
        PopupMenu.PopupMenuSection.prototype._init.call(this);

        this._am = am;

        this._switch = new PopupMenu.PopupSwitchMenuItem(groupName, true);
        this._switch.setStatus("loading\u2026");
        this.addMenuItem(this._switch);

        this._accountIDs = accountIDs;
        this._accounts = [];
    },

    helloThere: function(accounts) {
        let state = false;

        for (let i = 0; i < accounts.length; i++) {
            let account = accounts[i];
            if (this._accountIDs.indexOf(account.get_path_suffix()) >= 0) {
                this._accounts.push(account);
                /* If any account in this group is enabled, show the whole
                 * group as enabled.
                 */
                state = state || account.is_enabled();

                /* Only list accounts if there's more than one */
                if (this._accountIDs.length > 1) {
                    let nameItem = new AccountItem(account);
                    this.addMenuItem(nameItem);
                }
            }
        }

        if (this._accounts.length > 0) {
            this._switch.setToggleState(state);
            this._switch.setStatus(null);

            this._switch.connect('toggled', Lang.bind(this,
                function(item) { this._onToggled(item); }));
        } else {
            this._switch.setStatus("\u2639");
        }
    },

    _onToggled: function(item) {
        let state = item.state;

        for (let i = 0; i < this._accounts.length; i++) {
            let account = this._accounts[i];
            account.set_enabled_async(state, Lang.bind(this, function() {
                if (state) {
                    let [presence, status, msg] = this._am.get_most_available_presence();

                    account.request_presence_async(presence, status, msg,
                        function() {});
                }
            }));
        }

    },
}

function CAGMenu() {
    this._init();
}

CAGMenu.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'avatar-default-symbolic', null);

        this._sections = [];
        this._loadConfig();

        this._editorEverAppeared = false;
        this._signalID = Gio.bus_get_sync(Gio.BusType.SESSION, null).signal_subscribe(
            "uk.me.wjt.ChatAccountGroups",
            "uk.me.wjt.ChatAccountGroups",
            "Edited",
            "/uk/me/wjt/ChatAccountGroups",
            null, 0,
            Lang.bind(this, this._groupsEdited));

        this._am = Tp.AccountManager.dup();
        this._amReady = false;
        this._prepare();
    },

    _loadConfig: function() {
        this.menu.removeAll();
        this._sections = [];

        let accountFile = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            "shell-chat-account-groups",
            "groups.2.json"]);
        try {
            /* Stupid. The first returned value is true. */
            let ret = GLib.file_get_contents(accountFile);
            let groups = JSON.parse(ret[1]);
            this._createSections(groups);
        } catch (error) {
            global.log("no configured groups. falling back to one per account");
        }
    },

    _createSections: function(groups) {
        for (let i = 0; i < groups.length; i++) {
            let group = groups[i];
            let groupName = group.name;
            let accounts = group.accounts;
            let section = new AccountGroupSection(this._am, groupName, accounts);
            this.menu.addMenuItem(section);
            this._sections.push(section);
        }
    },

    _prepare: function() {
        this._am.prepare_async(null, Lang.bind(this,
            function(am) {
                this._amReady = true;
                this._pushAccountsIntoSections();
            }));
    },

    _pushAccountsIntoSections: function() {
        let accounts = this._am.get_valid_accounts();

        if (this._sections.length > 0) {
            for (let i = 0; i < this._sections.length; i++) {
                this._sections[i].helloThere(accounts);
            }
        } else {
            const NUM_ACCOUNTS_BEFORE_OVERFLOWING = 10;
            let overflowItem = null;

            for (let i = 0; i < accounts.length; i++) {
                let account = accounts[i];
                let section = new AccountGroupSection(this._am, account.get_display_name(), [account.get_path_suffix()]);
                section.helloThere(accounts);

                if (i < NUM_ACCOUNTS_BEFORE_OVERFLOWING) {
                    this.menu.addMenuItem(section);
                } else {
                    if (!overflowItem) {
                        overflowItem = new PopupMenu.PopupSubMenuMenuItem("More...");
                        this.menu.addMenuItem(overflowItem);
                    }

                    overflowItem.menu.addMenuItem(section);
                }
            }
        }

        let separator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(separator);

        this.menu.addAction("Chat Account Group Settings",
            Lang.bind(this, this._launchSettings));
    },

    _launchSettings: function(event) {
        let meta = ExtensionSystem.extensionMeta[
             "chat-account-groups@shell-extensions.wjt.me.uk"];
        let path = meta.path + "/edit-groups";

        GLib.spawn_async(null, ["python", path], null, GLib.SpawnFlags.SEARCH_PATH, null, null, null, null);
    },

    _groupsEdited: function() {
        global.log("groups edited!");
        this._loadConfig();
        if (this._amReady) {
            this._pushAccountsIntoSections();
        }
    },
};

function init(metadata) {
}

let groupsMenu;

function enable() {
    groupsMenu = new CAGMenu;
    Main.panel.addToStatusArea('chat-account-groups-menu', groupsMenu);
}

function disable() {
    groupsMenu.destroy();
}

/* vim: set fileencoding=utf-8 sts=4 sw=4 et : */
