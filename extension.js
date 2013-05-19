/*
 * Copyright © 2012–2013 Will Thompson <will@willthompson.co.uk>
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
const ExtensionUtils = imports.misc.extensionUtils;

const debugEnabled = false;

function debug() {
    if (debugEnabled) {
        global.log(Array.prototype.join.call(arguments, ' '));
    }
}

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
        account.connect('notify::connection-status', Lang.bind(this,
            this._onStatusChanged));

        let [presence, status, message] = account.get_current_presence();
        this._onPresenceChanged(account, presence, status, message);
    },

    _setPresenceLabel: function(text) {
        this._presenceLabel.text = text;
    },

    _onPresenceChanged: function(account, presence, status, message) {
        debug("_onPresenceChanged for", account.get_path_suffix(), presence, status);

        if (status == "") {
            switch (presence) {
                case Tp.ConnectionPresenceType.UNSET:
                    /* Idle doesn't support SimplePresence. When accounts are
                     * online but don't support SimplePresence, this property comes
                     * out as Unset. This is documented in the spec (but not in
                     * the tp-glib docs).
                     */
                    status = "online";
                    break;

                /* In all other cases, status should be a non-empty string. But
                 * just in case…
                 */
                case Tp.ConnectionPresenceType.OFFLINE:
                    status = "offline";
                    break;

                default:
                    status = "something strange (" + presence + ")";
                    break;
            }
        }

        this._setPresenceLabel(status);
    },

    _onStatusChanged: function(account) {
        try {
            let [conn_status, reason] = account.get_connection_status();

            if (conn_status == Tp.ConnectionStatus.CONNECTING) {
                this._setPresenceLabel("connecting\u2026");
            }
        } catch (e) {
            debug("_onStatusChanged threw", e);
        }
    }
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

    getMaximumHeight: function() {
        if (this._accountIDs.length > 1) {
            return this._accountIDs.length + 1;
        } else {
            return 1;
        }
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

        this._rows = 0;
        this._overflowItem = null;

        this._accountFilePath = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            "shell-chat-account-groups",
            "groups.2.json"]);
        this._accountFile = Gio.File.new_for_path(this._accountFilePath);
        this._accountFileMonitor = this._accountFile.monitor_file(
            Gio.FileMonitorFlags.NONE, null);
        this._accountFileMonitorChangedId = this._accountFileMonitor.connect(
            'changed', Lang.bind(this, this._groupsEdited));

        this._am = Tp.AccountManager.dup();
        this._amReady = false;

        this._loadConfig();
        this._prepare();
    },

    destroy: function() {
        this._accountFileMonitor.disconnect(this._accountFileMonitorChangedId);
        PanelMenu.SystemStatusButton.prototype.destroy.call(this);
    },

    _loadConfig: function() {
        this.menu.removeAll();
        this._sections = [];
        this._rows = 0;
        this._overflowItem = null;

        try {
            /* Stupid. The first returned value is true. */
            let ret = GLib.file_get_contents(this._accountFilePath);
            let groups = JSON.parse(ret[1]);
            this._createSections(groups);
        } catch (error) {
            debug("no configured groups. falling back to one per account");
        }
    },

    _addSection: function(section) {
        const NUM_ITEMS_BEFORE_OVERFLOWING = 10;

        if (this._rows > NUM_ITEMS_BEFORE_OVERFLOWING) {
            if (!this._overflowItem) {
                this._overflowItem = new PopupMenu.PopupSubMenuMenuItem("More\u2026");
                this.menu.addMenuItem(this._overflowItem);
            }

            this._overflowItem.menu.addMenuItem(section);
        } else {
            this.menu.addMenuItem(section);
            this._rows += section.getMaximumHeight();
        }

        this._sections.push(section);
    },

    _createSections: function(groups) {
        for (let i = 0; i < groups.length; i++) {
            let group = groups[i];
            let groupName = group.name;
            let accounts = group.accounts;
            let section = new AccountGroupSection(this._am, groupName, accounts);

            this._addSection(section);
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
            accounts.sort(function(a, b) {
                var a_name = a.get_display_name().toLocaleLowerCase(),
                    b_name = b.get_display_name().toLocaleLowerCase();

                return a_name.localeCompare(b_name);
            });

            for (let i = 0; i < accounts.length; i++) {
                let account = accounts[i];
                let section = new AccountGroupSection(this._am, account.get_display_name(), [account.get_path_suffix()]);
                section.helloThere(accounts);

                this._addSection(section);
            }
        }

        let separator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(separator);

        this.menu.addAction("Edit Chat Account Groups",
            Lang.bind(this, this._launchSettings));
    },

    _launchSettings: function(event) {
        let meta = ExtensionUtils.getCurrentExtension();
        let path = meta.path + "/edit-groups";

        GLib.spawn_async(null, ["python", path], null, GLib.SpawnFlags.SEARCH_PATH, null, null, null, null);
    },

    _groupsEdited: function(monitor, file, other_file, event_type) {
        if (event_type == Gio.FileMonitorEvent.CHANGES_DONE_HINT) {
            debug("groups edited!");
            this._loadConfig();
            if (this._amReady) {
                this._pushAccountsIntoSections();
            }
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
